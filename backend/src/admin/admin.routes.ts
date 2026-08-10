import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAdmin, requireAuth } from "../auth/auth.middleware";
import { hashPassword } from "../auth/auth.service";

export const adminRouter = Router();
adminRouter.use(requireAuth);

// --- Mensaje del dashboard --------------------------------------------------
adminRouter.get("/dashboard-message", async (_req, res) => {
  const mensaje = await prisma.mensajeDashboard.findFirst({ orderBy: { fechaActualizacion: "desc" } });
  res.json(mensaje);
});

const mensajeSchema = z.object({ texto: z.string() });

adminRouter.put("/dashboard-message", requireAdmin, async (req, res) => {
  const parsed = mensajeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const existente = await prisma.mensajeDashboard.findFirst();
  const mensaje = existente
    ? await prisma.mensajeDashboard.update({
        where: { id: existente.id },
        data: { texto: parsed.data.texto, autorId: req.user!.sub },
      })
    : await prisma.mensajeDashboard.create({
        data: { texto: parsed.data.texto, autorId: req.user!.sub },
      });
  res.json(mensaje);
});

// --- Horarios extraordinarios ------------------------------------------------
adminRouter.get("/horarios-extraordinarios", async (_req, res) => {
  const horarios = await prisma.horarioExtraordinario.findMany({
    where: { fecha: { gte: new Date(new Date().toDateString()) } },
    include: { biblioteca: true },
    orderBy: { fecha: "asc" },
  });
  res.json(horarios);
});

const horarioSchema = z.object({
  bibliotecaId: z.string(),
  fecha: z.string(),
  texto: z.string().min(1),
});

adminRouter.post("/horarios-extraordinarios", requireAdmin, async (req, res) => {
  const parsed = horarioSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  const horario = await prisma.horarioExtraordinario.create({
    data: { ...parsed.data, fecha: new Date(parsed.data.fecha), autorId: req.user!.sub },
  });
  res.status(201).json(horario);
});

adminRouter.patch("/horarios-extraordinarios/:id", requireAdmin, async (req, res) => {
  const parsed = horarioSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  const data = { ...parsed.data, fecha: parsed.data.fecha ? new Date(parsed.data.fecha) : undefined };
  const horario = await prisma.horarioExtraordinario.update({ where: { id: req.params.id }, data });
  res.json(horario);
});

adminRouter.delete("/horarios-extraordinarios/:id", requireAdmin, async (req, res) => {
  await prisma.horarioExtraordinario.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// --- Gestión de cuentas BiblioBot --------------------------------------------
adminRouter.get("/usuarios", requireAdmin, async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nombre: true, email: true, username: true, rol: true, activo: true, fechaCreacion: true },
    orderBy: { fechaCreacion: "desc" },
  });
  res.json(usuarios);
});

const crearUsuarioSchema = z
  .object({
    nombre: z.string().min(1),
    usaCorreo: z.boolean(),
    email: z.string().email().optional(),
    username: z.string().min(3).optional(),
    password: z.string().min(8),
    rol: z.enum(["admin", "usuario"]).default("usuario"),
  })
  .refine((data) => (data.usaCorreo ? !!data.email : !!data.username), {
    message: "Falta el email o el nombre de usuario",
  });

adminRouter.post("/usuarios", requireAdmin, async (req, res) => {
  const parsed = crearUsuarioSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  const { nombre, usaCorreo, email, username, password, rol } = parsed.data;

  const existente = await prisma.usuario.findFirst({
    where: usaCorreo ? { email } : { username },
  });
  if (existente) return res.status(409).json({ error: "Ya existe una cuenta con ese email o nombre de usuario" });

  const passwordHash = await hashPassword(password);
  const usuario = await prisma.usuario.create({
    data: {
      nombre,
      email: usaCorreo ? email : null,
      username: usaCorreo ? null : username,
      passwordHash,
      rol,
    },
  });
  res.status(201).json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, username: usuario.username, rol: usuario.rol });
});

const actualizarUsuarioSchema = z.object({
  nombre: z.string().min(1).optional(),
  activo: z.boolean().optional(),
  rol: z.enum(["admin", "usuario"]).optional(),
  passwordNueva: z.string().min(8).optional(),
});

adminRouter.patch("/usuarios/:id", requireAdmin, async (req, res) => {
  const parsed = actualizarUsuarioSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  const { passwordNueva, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (passwordNueva) data.passwordHash = await hashPassword(passwordNueva);

  const usuario = await prisma.usuario.update({ where: { id: req.params.id }, data });
  res.json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, username: usuario.username, rol: usuario.rol, activo: usuario.activo });
});

adminRouter.delete("/usuarios/:id", requireAdmin, async (req, res) => {
  if (req.params.id === req.user!.sub) {
    return res.status(400).json({ error: "No puedes eliminar tu propia cuenta" });
  }
  await prisma.usuario.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
