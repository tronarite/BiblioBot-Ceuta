import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth/auth.middleware";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS, hashPassword, normalizeEmail, signToken, verifyPassword } from "../auth/auth.service";
import { serializeUsuario } from "./serialize";

export const selfRouter = Router();
selfRouter.use(requireAuth);

selfRouter.get("/", async (req, res) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: req.user!.sub } });
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json(await serializeUsuario(usuario));
});

const updateSchema = z.object({
  nombre: z.string().min(1).optional(),
  email: z.string().email().optional(),
  passwordActual: z.string().optional(),
  passwordNueva: z.string().min(8).optional(),
  bibliotecasOcultas: z.array(z.string()).optional(),
});

selfRouter.patch("/", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  const { nombre, email, passwordActual, passwordNueva, bibliotecasOcultas } = parsed.data;
  const usuario = await prisma.usuario.findUnique({ where: { id: req.user!.sub } });
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

  const data: {
    nombre?: string;
    email?: string;
    passwordHash?: string;
    bibliotecasOcultas?: string;
    debeCambiarPassword?: boolean;
    sesionesValidasDesde?: Date;
  } = {};
  if (nombre) data.nombre = nombre;
  if (email) {
    data.email = normalizeEmail(email);
    const otro = await prisma.usuario.findUnique({ where: { email: data.email } });
    if (otro && otro.id !== usuario.id) return res.status(409).json({ error: "Ese email ya lo usa otra cuenta" });
  }
  if (bibliotecasOcultas) data.bibliotecasOcultas = JSON.stringify(bibliotecasOcultas);

  if (passwordNueva) {
    if (!passwordActual || !(await verifyPassword(passwordActual, usuario.passwordHash))) {
      return res.status(401).json({ error: "La contraseña actual no es correcta" });
    }
    data.passwordHash = await hashPassword(passwordNueva);
    data.debeCambiarPassword = false; // ya la ha cambiado él mismo
    data.sesionesValidasDesde = new Date(); // cierra las demás sesiones abiertas
  }

  const actualizado = await prisma.usuario.update({ where: { id: usuario.id }, data });
  if (passwordNueva) {
    // Esta sesión sigue: se le da un token nuevo, posterior al cambio.
    res.cookie(AUTH_COOKIE_NAME, signToken({ sub: usuario.id, rol: usuario.rol === "admin" ? "admin" : "usuario" }), AUTH_COOKIE_OPTIONS);
  }
  res.json(await serializeUsuario(actualizado));
});
