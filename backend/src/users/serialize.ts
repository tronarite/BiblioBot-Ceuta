import type { Usuario } from "@prisma/client";
import { prisma } from "../db";

/**
 * Forma del usuario que ve el frontend. Incluye:
 * - debeCambiarPassword: si un admin le restableció la contraseña y todavía no la cambió.
 * - patronbaseEstado: para poder avisar de forma global cuando el vínculo con PatronBase
 *   está en "error" (credenciales caducadas → todas sus programaciones fallarían en silencio).
 */
export async function serializeUsuario(usuario: Usuario) {
  const cuenta = await prisma.cuentaPatronBase.findUnique({
    where: { usuarioId: usuario.id },
    select: { estadoVinculacion: true },
  });
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    username: usuario.username,
    rol: usuario.rol,
    activo: usuario.activo,
    debeCambiarPassword: usuario.debeCambiarPassword,
    bibliotecasOcultas: JSON.parse(usuario.bibliotecasOcultas) as string[],
    patronbaseEstado: (cuenta?.estadoVinculacion ?? "no_vinculada") as
      | "no_vinculada"
      | "vinculada"
      | "error",
  };
}
