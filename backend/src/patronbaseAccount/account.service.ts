import { prisma } from "../db";
import { decryptSecret, encryptSecret } from "../crypto/secretBox";
import { login } from "../patronbase/adapter";
import { PatronBaseSession } from "../patronbase/session";

export async function linkAccount(usuarioId: string, patronbaseEmail: string, patronbasePassword: string) {
  const session = new PatronBaseSession();
  const ok = await login(session, patronbaseEmail, patronbasePassword);
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
}

export async function getStatus(usuarioId: string) {
  const cuenta = await prisma.cuentaPatronBase.findUnique({ where: { usuarioId } });
  if (!cuenta) return { estadoVinculacion: "no_vinculada" as const, patronbaseEmail: null };
  return { estadoVinculacion: cuenta.estadoVinculacion, patronbaseEmail: cuenta.patronbaseEmail };
}

/**
 * Abre una sesión PatronBase autenticada para el usuario dado, usando sus credenciales
 * cifradas. Lanza si no tiene cuenta vinculada o si el login real falla (credenciales
 * cambiadas en PatronBase, cuenta bloqueada, etc.) — en ese caso marca el vínculo en error.
 */
export async function getAuthenticatedSession(usuarioId: string): Promise<PatronBaseSession> {
  const cuenta = await prisma.cuentaPatronBase.findUnique({ where: { usuarioId } });
  if (!cuenta || cuenta.estadoVinculacion !== "vinculada") {
    throw new Error("El usuario no tiene una cuenta PatronBase vinculada");
  }
  const password = decryptSecret(cuenta.credencialesCifrado);
  const session = new PatronBaseSession();
  const ok = await login(session, cuenta.patronbaseEmail, password);
  if (!ok) {
    await prisma.cuentaPatronBase.update({ where: { usuarioId }, data: { estadoVinculacion: "error" } });
    throw new Error("El login contra PatronBase falló con las credenciales guardadas");
  }
  await prisma.cuentaPatronBase.update({ where: { usuarioId }, data: { ultimaSincronizacion: new Date() } });
  return session;
}
