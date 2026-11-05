import { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import { AUTH_COOKIE_NAME, JwtPayload, verifyToken } from "./auth.service";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      cuentaId?: string; // cuenta PatronBase activa (ver requireCuenta)
      todasCuentas?: boolean; // vista virtual "todas las cuentas" (solo lectura)
    }
  }
}

/**
 * El JWT solo prueba quién es; lo demás se comprueba en la BD en cada petición: que el
 * usuario siga existiendo y activo, que el token no sea anterior a un cambio de
 * contraseña (sesionesValidasDesde) y el rol actual (no el que tenía al iniciar sesión).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "No autenticado" });
  }
  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Sesión inválida o caducada" });
  }
  const usuario = await prisma.usuario.findUnique({
    where: { id: payload.sub },
    select: { activo: true, rol: true, sesionesValidasDesde: true },
  });
  const revocado =
    usuario?.sesionesValidasDesde && (payload.iat ?? 0) < Math.floor(usuario.sesionesValidasDesde.getTime() / 1000);
  if (!usuario || !usuario.activo || revocado) {
    res.clearCookie(AUTH_COOKIE_NAME);
    return res.status(401).json({ error: "Sesión inválida o caducada" });
  }
  req.user = { sub: payload.sub, rol: usuario.rol === "admin" ? "admin" : "usuario" };
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.rol !== "admin") {
    return res.status(403).json({ error: "Requiere permisos de administrador" });
  }
  next();
}

/**
 * Resuelve la cuenta PatronBase activa de la petición: la de la cabecera X-Cuenta-Id (que
 * debe pertenecer al usuario autenticado) o, si no viene, su cuenta principal. Si el usuario
 * aún no tiene ninguna cuenta, req.cuentaId queda sin definir.
 * X-Cuenta-Id: todas es una vista virtual que junta las cuentas del usuario, solo para leer:
 * req.todasCuentas queda a true y req.cuentaId es la principal (las escrituras la rechazan).
 */
export async function requireCuenta(req: Request, res: Response, next: NextFunction) {
  try {
    const cabecera = req.header("x-cuenta-id");
    req.todasCuentas = cabecera === "todas";
    const pedida = req.todasCuentas ? undefined : cabecera;
    const cuenta = pedida
      ? await prisma.cuentaPatronBase.findFirst({ where: { id: pedida, usuarioId: req.user!.sub } })
      : await prisma.cuentaPatronBase.findFirst({
          where: { usuarioId: req.user!.sub },
          orderBy: [{ principal: "desc" }, { createdAt: "asc" }],
        });
    if (pedida && !cuenta) return res.status(404).json({ error: "Cuenta no encontrada" });
    req.cuentaId = cuenta?.id;
    next();
  } catch (err) {
    next(err);
  }
}
