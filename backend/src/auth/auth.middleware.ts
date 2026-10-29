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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "No autenticado" });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o caducada" });
  }
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
