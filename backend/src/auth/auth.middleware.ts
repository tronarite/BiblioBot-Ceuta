import { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE_NAME, JwtPayload, verifyToken } from "./auth.service";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
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
