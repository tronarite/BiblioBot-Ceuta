import { prisma } from "../db";
import { decryptSecret, encryptSecret } from "../crypto/secretBox";
import { login } from "../patronbase/adapter";
import { PatronBaseSession } from "../patronbase/session";
import { invalidarReservas } from "../reservations/reservations.service";

export async function linkAccount(usuarioId: string, patronbaseEmail: string, patronbasePassword: string) {
  const session = new PatronBaseSession();
  const ok = await login(session, patronbaseEmail, patronbasePassword);
  // Cambiar de cuenta PatronBase deja obsoletas las reservas cacheadas de la anterior.
  invalidarReservas(usuarioId);
  ultimoLoginFallido.delete(usuarioId);
  if (!ok) {
    await prisma.cuentaPatronBase.upsert({
      where: { usuarioId },
      update: { patronbaseEmail, estadoVinculacion: "error" },
      create: {
        usuarioId,
        patronbaseEmail,
        credencialesCifrado: encryptSecret(patronbasePassword),
        estadoVinculacion: "error",
      },
    });
    return { ok: false as const, error: "No se pudo iniciar sesión en PatronBase con esas credenciales" };
  }

  const credencialesCifrado = encryptSecret(patronbasePassword);
  const cuenta = await prisma.cuentaPatronBase.upsert({
    where: { usuarioId },
    update: {
      patronbaseEmail,
      credencialesCifrado,
      estadoVinculacion: "vinculada",
      ultimaSincronizacion: new Date(),
    },
    create: {
      usuarioId,
      patronbaseEmail,
      credencialesCifrado,
      estadoVinculacion: "vinculada",
      ultimaSincronizacion: new Date(),
    },
  });
  return { ok: true as const, cuenta };
}

export async function unlinkAccount(usuarioId: string) {
  await prisma.cuentaPatronBase.deleteMany({ where: { usuarioId } });
  invalidarReservas(usuarioId);
}

/**
 * Reintenta el login con las credenciales ya guardadas (sin que el usuario tenga que
 * volver a escribirlas), para el caso típico en que el fallo fue algo puntual del
 * scraper o de PatronBase y no un cambio real de contraseña.
 */
export async function retryLink(usuarioId: string) {
  const cuenta = await prisma.cuentaPatronBase.findUnique({ where: { usuarioId } });
  if (!cuenta) {
    return { ok: false as const, error: "No hay ninguna cuenta PatronBase vinculada" };
  }

  ultimoLoginFallido.delete(usuarioId);
  const password = decryptSecret(cuenta.credencialesCifrado);
  const session = new PatronBaseSession();
  const ok = await login(session, cuenta.patronbaseEmail, password);
  if (!ok) {
    await prisma.cuentaPatronBase.update({ where: { usuarioId }, data: { estadoVinculacion: "error" } });
    return { ok: false as const, error: "Sigue sin poder iniciar sesión en PatronBase con las credenciales guardadas" };
  }

  await prisma.cuentaPatronBase.update({
    where: { usuarioId },
    data: { estadoVinculacion: "vinculada", ultimaSincronizacion: new Date() },
  });
  return { ok: true as const };
}

export async function getStatus(usuarioId: string) {
  const cuenta = await prisma.cuentaPatronBase.findUnique({ where: { usuarioId } });
  if (!cuenta) return { estadoVinculacion: "no_vinculada" as const, patronbaseEmail: null };
  return { estadoVinculacion: cuenta.estadoVinculacion, patronbaseEmail: cuenta.patronbaseEmail };
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
export async function getAuthenticatedSession(usuarioId: string): Promise<PatronBaseSession> {
  const cuenta = await prisma.cuentaPatronBase.findUnique({ where: { usuarioId } });
  if (!cuenta) throw new Error("El usuario no tiene una cuenta PatronBase vinculada");

  if (cuenta.estadoVinculacion !== "vinculada") {
    const ultimo = ultimoLoginFallido.get(usuarioId);
    if (ultimo !== undefined && Date.now() - ultimo < ESPERA_TRAS_LOGIN_FALLIDO_MS) {
      throw new Error("La cuenta PatronBase está en error; se reintentará la conexión automáticamente en unos minutos");
    }
  }

  const password = decryptSecret(cuenta.credencialesCifrado);
  // Un segundo intento inmediato absorbe los fallos puntuales de PatronBase antes de
  // dar el vínculo por roto.
  let session = new PatronBaseSession();
  let ok = await login(session, cuenta.patronbaseEmail, password);
  if (!ok) {
    session = new PatronBaseSession();
    ok = await login(session, cuenta.patronbaseEmail, password);
  }
  if (!ok) {
    ultimoLoginFallido.set(usuarioId, Date.now());
    await prisma.cuentaPatronBase.update({ where: { usuarioId }, data: { estadoVinculacion: "error" } });
    throw new Error("El login contra PatronBase falló con las credenciales guardadas");
  }
  ultimoLoginFallido.delete(usuarioId);
  await prisma.cuentaPatronBase.update({
    where: { usuarioId },
    data: { estadoVinculacion: "vinculada", ultimaSincronizacion: new Date() },
  });
  return session;
}
