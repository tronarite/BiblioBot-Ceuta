import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAdmin, requireAuth } from "../auth/auth.middleware";
import { generarPasswordTemporal, hashPassword, normalizeEmail } from "../auth/auth.service";
import { comprobarScraper } from "../monitor/scraper-monitor";
import { calcularProximaEjecucion } from "../schedules/schedules.service";

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
// Solo texto libre en Markdown: sin biblioteca ni fechas estructuradas, se listan todos
// y el admin borra los que ya no aplican (ver comentario en schema.prisma).
adminRouter.get("/horarios-extraordinarios", async (_req, res) => {
  const horarios = await prisma.horarioExtraordinario.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(horarios);
});

const horarioSchema = z.object({ texto: z.string().min(1) });

adminRouter.post("/horarios-extraordinarios", requireAdmin, async (req, res) => {
  const parsed = horarioSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  const horario = await prisma.horarioExtraordinario.create({
    data: { texto: parsed.data.texto, autorId: req.user!.sub },
  });
  res.status(201).json(horario);
});

adminRouter.patch("/horarios-extraordinarios/:id", requireAdmin, async (req, res) => {
  const parsed = horarioSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  const horario = await prisma.horarioExtraordinario.update({
    where: { id: req.params.id },
    data: { texto: parsed.data.texto },
  });
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
  const { nombre, usaCorreo, username, password, rol } = parsed.data;
  const email = usaCorreo && parsed.data.email ? normalizeEmail(parsed.data.email) : undefined;

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

// Restablece la contraseña de un usuario: genera una temporal, la devuelve una sola vez
// para que el admin se la comunique, y obliga al usuario a cambiarla al entrar.
adminRouter.post("/usuarios/:id/reset-password", requireAdmin, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: req.params.id } });
  if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
  const passwordTemporal = generarPasswordTemporal();
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { passwordHash: await hashPassword(passwordTemporal), debeCambiarPassword: true },
  });
  res.json({ passwordTemporal });
});

// --- Vista global de administración ----------------------------------------
adminRouter.get("/estado-sistema", requireAdmin, async (_req, res) => {
  const [scraper, cuentas, programacionesActivas] = await Promise.all([
    prisma.estadoScraper.findUnique({ where: { id: "scraper" } }),
    prisma.cuentaPatronBase.groupBy({ by: ["estadoVinculacion"], _count: true }),
    prisma.programacion.count({ where: { estado: "activa" } }),
  ]);
  const porEstado = { no_vinculada: 0, vinculada: 0, error: 0 } as Record<string, number>;
  for (const c of cuentas) porEstado[c.estadoVinculacion] = c._count;
  res.json({ scraper, cuentasPatronBase: porEstado, programacionesActivas });
});

adminRouter.post("/estado-sistema/comprobar-scraper", requireAdmin, async (_req, res) => {
  const resultado = await comprobarScraper();
  res.json(resultado);
});

adminRouter.get("/programaciones", requireAdmin, async (_req, res) => {
  const programaciones = await prisma.programacion.findMany({
    include: { biblioteca: true, planta: true, usuario: { select: { nombre: true, email: true, username: true } } },
    orderBy: { estado: "asc" },
  });
  // proximaEjecucion se recalcula en cada lectura (ver calcularProximaEjecucion): un
  // valor persistido se queda obsoleto en cuanto la programación se pausa o pasa un
  // día sin éxito, así que tampoco sirve para ordenar directamente en SQL.
  const conProximaEjecucion = programaciones.map((p) => ({ ...p, proximaEjecucion: calcularProximaEjecucion(p) }));
  conProximaEjecucion.sort((a, b) => {
    if (a.estado !== b.estado) return a.estado.localeCompare(b.estado);
    return (a.proximaEjecucion?.getTime() ?? Infinity) - (b.proximaEjecucion?.getTime() ?? Infinity);
  });
  res.json(conProximaEjecucion);
});

adminRouter.get("/actividad", requireAdmin, async (_req, res) => {
  const actividad = await prisma.actividadLog.findMany({
    take: 150,
    orderBy: { fecha: "desc" },
    include: {
      usuario: { select: { nombre: true } },
      programacion: { select: { nombre: true } },
    },
  });
  res.json(actividad);
});
