import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth/auth.middleware";
import { hashPassword, verifyPassword } from "../auth/auth.service";

export const selfRouter = Router();
selfRouter.use(requireAuth);

selfRouter.get("/", async (req, res) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: req.user!.sub } });
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, username: usuario.username, rol: usuario.rol });
});

const updateSchema = z.object({
  nombre: z.string().min(1).optional(),
  email: z.string().email().optional(),
  passwordActual: z.string().optional(),
  passwordNueva: z.string().min(8).optional(),
});

selfRouter.patch("/", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  const { nombre, email, passwordActual, passwordNueva } = parsed.data;
  const usuario = await prisma.usuario.findUnique({ where: { id: req.user!.sub } });
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

  const data: { nombre?: string; email?: string; passwordHash?: string } = {};
  if (nombre) data.nombre = nombre;
  if (email) data.email = email;

  if (passwordNueva) {
    if (!passwordActual || !(await verifyPassword(passwordActual, usuario.passwordHash))) {
      return res.status(401).json({ error: "La contraseña actual no es correcta" });
    }
    data.passwordHash = await hashPassword(passwordNueva);
  }

  const actualizado = await prisma.usuario.update({ where: { id: usuario.id }, data });
  res.json({ id: actualizado.id, nombre: actualizado.nombre, email: actualizado.email, username: actualizado.username, rol: actualizado.rol });
});
