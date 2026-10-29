import { prisma } from "../db";
import { decryptSecret, encryptSecret } from "../crypto/secretBox";
import { login } from "../patronbase/adapter";
import { PatronBaseSession } from "../patronbase/session";
import { invalidarReservas } from "../reservations/reservations.service";

const MAX_CUENTAS = 5;

/**
 * Añade una cuenta PatronBase al usuario (la primera es la principal). Si ya tiene una con
 * ese mismo email, actualiza sus credenciales en vez de duplicarla. Valida el login real
 * contra PatronBase antes de guardar nada como "vinculada".
 */
export async function addCuenta(usuarioId: string, patronbaseEmail: string, patronbasePassword: string, alias?: string) {
  const email = patronbaseEmail.trim();
  const existentes = await prisma.cuentaPatronBase.findMany({ where: { usuarioId } });
  const misma = existentes.find((c) => c.patronbaseEmail.toLowerCase() === email.toLowerCase());
  if (!misma && existentes.length >= MAX_CUENTAS) {
    return { ok: false as const, error: `Máximo ${MAX_CUENTAS} cuentas por usuario` };
  }

  const session = new PatronBaseSession();
  const ok = await login(session, email, patronbasePassword);
  if (misma) {
    invalidarReservas(misma.id);
    ultimoLoginFallido.delete(misma.id);
  }
  const credencialesCifrado = encryptSecret(patronbasePassword);
  const estado = ok ? { estadoVinculacion: "vinculada", ultimaSincronizacion: new Date() } : { estadoVinculacion: "error" };

  if (!ok && !misma) {
    // Una cuenta nueva con credenciales incorrectas no se guarda.
    return { ok: false as const, error: "No se pudo iniciar sesión en PatronBase con esas credenciales" };
  }
  if (!ok && misma) {
    await prisma.cuentaPatronBase.update({ where: { id: misma.id }, data: { patronbaseEmail: email, estadoVinculacion: "error" } });
    return { ok: false as const, error: "No se pudo iniciar sesión en PatronBase con esas credenciales" };
  }

  const cuenta = misma
    ? await prisma.cuentaPatronBase.update({ where: { id: misma.id }, data: { patronbaseEmail: email, credencialesCifrado, ...estado } })
    : await prisma.cuentaPatronBase.create({
        data: {
          usuarioId,
          patronbaseEmail: email,
          credencialesCifrado,
          alias: alias?.trim() || null,
          principal: existentes.length === 0,
          ...estado,
        },
      });
  return { ok: true as const, cuenta };
}

/** La cuenta principal no se puede quitar mientras haya secundarias, ni se borra a la ligera. */
export async function removeCuenta(usuarioId: string, cuentaId: string) {
  const cuenta = await prisma.cuentaPatronBase.findFirst({ where: { id: cuentaId, usuarioId } });
  if (!cuenta) return { ok: false as const, status: 404, error: "Cuenta no encontrada" };
  if (cuenta.principal) {
    const otras = await prisma.cuentaPatronBase.count({ where: { usuarioId, id: { not: cuentaId } } });
    if (otras > 0) return { ok: false as const, status: 409, error: "Quita primero las cuentas secundarias" };
  }
  await prisma.cuentaPatronBase.delete({ where: { id: cuentaId } });
  invalidarReservas(cuentaId);
  ultimoLoginFallido.delete(cuentaId);
  return { ok: true as const };
}

/**
 * Reintenta el login con las credenciales ya guardadas (sin que el usuario tenga que
 * volver a escribirlas), para el caso típico en que el fallo fue algo puntual del
 * scraper o de PatronBase y no un cambio real de contraseña.
 */
export async function retryLink(usuarioId: string, cuentaId: string) {
  const cuenta = await prisma.cuentaPatronBase.findFirst({ where: { id: cuentaId, usuarioId } });
  if (!cuenta) {
    return { ok: false as const, error: "No hay ninguna cuenta PatronBase vinculada" };
  }

  ultimoLoginFallido.delete(cuenta.id);
  const password = decryptSecret(cuenta.credencialesCifrado);
  const session = new PatronBaseSession();
  const ok = await login(session, cuenta.patronbaseEmail, password);
  if (!ok) {
    await prisma.cuentaPatronBase.update({ where: { id: cuenta.id }, data: { estadoVinculacion: "error" } });
    return { ok: false as const, error: "Sigue sin poder iniciar sesión en PatronBase con las credenciales guardadas" };
  }

  await prisma.cuentaPatronBase.update({
    where: { id: cuenta.id },
    data: { estadoVinculacion: "vinculada", ultimaSincronizacion: new Date() },
  });
  return { ok: true as const };
}

export function serializeCuenta(c: {
  id: string;
  alias: string | null;
  patronbaseEmail: string;
  principal: boolean;
  estadoVinculacion: string;
  modoReservas: string;
  reservasDeCuentas: string;
  modoProgramaciones: string;
  programacionesDeCuentas: string;
}) {
  return {
    id: c.id,
    alias: c.alias,
    patronbaseEmail: c.patronbaseEmail,
    principal: c.principal,
    estadoVinculacion: c.estadoVinculacion as "vinculada" | "error" | "no_vinculada",
    modoReservas: c.modoReservas as "esta" | "todas" | "seleccionadas",
    reservasDeCuentas: JSON.parse(c.reservasDeCuentas) as string[],
    modoProgramaciones: c.modoProgramaciones as "esta" | "todas" | "seleccionadas",
    programacionesDeCuentas: JSON.parse(c.programacionesDeCuentas) as string[],
  };
}

export async function listCuentas(usuarioId: string) {
  const cuentas = await prisma.cuentaPatronBase.findMany({
    where: { usuarioId },
    orderBy: [{ principal: "desc" }, { createdAt: "asc" }],
  });
  return cuentas.map(serializeCuenta);
}

/** Ajustes de una cuenta: alias y qué reservas muestra el dashboard cuando está activa. */
export async function updateCuenta(
  usuarioId: string,
  cuentaId: string,
  data: {
    alias?: string | null;
    modoReservas?: "esta" | "todas" | "seleccionadas";
    reservasDeCuentas?: string[];
    modoProgramaciones?: "esta" | "todas" | "seleccionadas";
    programacionesDeCuentas?: string[];
  },
) {
  const cuenta = await prisma.cuentaPatronBase.findFirst({ where: { id: cuentaId, usuarioId } });
  if (!cuenta) return null;
  // Solo ids de cuentas del mismo usuario.
  const soloPropias = async (ids?: string[]) => {
    if (!ids) return undefined;
    const propias = await prisma.cuentaPatronBase.findMany({ where: { usuarioId, id: { in: ids } }, select: { id: true } });
    return JSON.stringify(propias.map((c) => c.id));
  };
  const reservasDeCuentas = await soloPropias(data.reservasDeCuentas);
  const programacionesDeCuentas = await soloPropias(data.programacionesDeCuentas);
  const actualizada = await prisma.cuentaPatronBase.update({
    where: { id: cuentaId },
    data: { alias: data.alias === undefined ? undefined : data.alias?.trim() || null, modoReservas: data.modoReservas,
      reservasDeCuentas,
      modoProgramaciones: data.modoProgramaciones,
      programacionesDeCuentas,
    },
  });
  return serializeCuenta(actualizada);
}

// Tras un login fallido con las credenciales guardadas no se vuelve a probar hasta pasado
// este tiempo: reconecta sola si el fallo fue puntual, pero sin martillear PatronBase (ni
// arriesgar un bloqueo de la cuenta) si la contraseña ha cambiado de verdad.
const ESPERA_TRAS_LOGIN_FALLIDO_MS = 10 * 60 * 1000;
const ultimoLoginFallido = new Map<string, number>();

/**
 * Abre una sesión PatronBase autenticada para el usuario dado, usando sus credenciales
 * cifradas. Lanza si no tiene cuenta vinculada o si el login real falla (credenciales
 * cambiadas en PatronBase, cuenta bloqueada, etc.) — en ese caso marca el vínculo en error.
 * Un vínculo en error se reintenta solo (con espera) y vuelve a "vinculada" en cuanto el
 * login funciona, sin que el usuario tenga que pulsar "Reintentar".
 */
export async function getAuthenticatedSession(cuentaId: string): Promise<PatronBaseSession> {
  const cuenta = await prisma.cuentaPatronBase.findUnique({ where: { id: cuentaId } });
  if (!cuenta) throw new Error("El usuario no tiene una cuenta PatronBase vinculada");

  if (cuenta.estadoVinculacion !== "vinculada") {
    const ultimo = ultimoLoginFallido.get(cuentaId);
    if (ultimo !== undefined && Date.now() - ultimo < ESPERA_TRAS_LOGIN_FALLIDO_MS) {
      throw new Error("La cuenta PatronBase está en error; se reintentará la conexión automáticamente en unos minutos");
    }
  }

  const password = decryptSecret(cuenta.credencialesCifrado);
  // Varios intentos con una pequeña espera absorben los fallos puntuales de PatronBase
  // (la web se atasca o rechaza un login suelto) antes de dar el vínculo por roto.
  let session = new PatronBaseSession();
  let ok = await login(session, cuenta.patronbaseEmail, password);
  for (const esperaMs of [1500, 4000]) {
    if (ok) break;
    await new Promise((r) => setTimeout(r, esperaMs));
    session = new PatronBaseSession();
    ok = await login(session, cuenta.patronbaseEmail, password);
  }
  if (!ok) {
    console.warn(`[patronbase] login fallido tras 3 intentos para ${cuenta.patronbaseEmail}`);
    ultimoLoginFallido.set(cuentaId, Date.now());
    await prisma.cuentaPatronBase.update({ where: { id: cuentaId }, data: { estadoVinculacion: "error" } });
    throw new Error("El login contra PatronBase falló con las credenciales guardadas");
  }
  ultimoLoginFallido.delete(cuentaId);
  await prisma.cuentaPatronBase.update({
    where: { id: cuentaId },
    data: { estadoVinculacion: "vinculada", ultimaSincronizacion: new Date() },
  });
  return session;
}
