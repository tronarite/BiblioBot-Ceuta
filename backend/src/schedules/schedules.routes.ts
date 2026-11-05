import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireCuenta } from "../auth/auth.middleware";
import { listActivity } from "../activity/activity.service";
import { addToGroup, createGroup, createSchedule, deleteGroup, deleteSchedule, removeFromGroup, renameGroup, setGroupEstado, getSchedule, listSchedules, setEstado, updateSchedule } from "./schedules.service";

export const schedulesRouter = Router();
schedulesRouter.use(requireAuth, requireCuenta);
schedulesRouter.use((req, res, next) => {
  if (!req.cuentaId) return res.status(422).json({ error: "No tienes una cuenta PatronBase vinculada" });
  next();
});

schedulesRouter.get("/", async (req, res) => {
  const items = await listSchedules(req.user!.sub, req.cuentaId!, req.todasCuentas);
  res.json(items);
});

// Una fecha que no se pueda interpretar se rechaza aquí (400) en vez de llegar a la BD como Invalid Date.
const fechaValida = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Fecha no válida");

const crearSchema = z.object({
  nombre: z.string().trim().min(1).max(80).optional(),
  bibliotecaId: z.string(),
  plantaId: z.string(),
  turnos: z.array(z.enum(["manana", "tarde"])).min(1),
  tipo: z.enum(["n_reservas", "hasta_fecha", "indefinida"]),
  valorTipoNumero: z.number().int().positive().optional(),
  valorTipoFecha: fechaValida.optional(),
  diasSemana: z.array(z.number().int().min(0).max(6)).min(1),
  asientosCodigos: z.array(z.string().trim().min(1)).min(1).max(10),
});

schedulesRouter.post("/", async (req, res) => {
  if (req.todasCuentas) return res.status(422).json({ error: "Elige una cuenta concreta para crear la programación" });
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  try {
    const programacion = await createSchedule({ usuarioId: req.user!.sub, cuentaId: req.cuentaId!, ...parsed.data });
    res.status(201).json(programacion);
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

const grupoNombre = z.string().trim().min(1).max(80);
const idsSchema = z.array(z.string()).min(1).max(50);

schedulesRouter.post("/grupos", async (req, res) => {
  const parsed = z.object({ nombre: grupoNombre, ids: idsSchema.min(2) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  try {
    res.status(201).json(await createGroup(req.user!.sub, parsed.data.nombre, parsed.data.ids));
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

schedulesRouter.post("/grupos/:id/miembros", async (req, res) => {
  const parsed = z.object({ ids: idsSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  try {
    await addToGroup(req.params.id, req.user!.sub, parsed.data.ids);
    res.status(204).send();
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

schedulesRouter.patch("/grupos/:id", async (req, res) => {
  const parsed = z
    .object({ nombre: grupoNombre.optional(), estado: z.enum(["activa", "pausada"]).optional() })
    .refine((d) => Object.keys(d).length > 0)
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  try {
    if (parsed.data.nombre) await renameGroup(req.params.id, req.user!.sub, parsed.data.nombre);
    if (parsed.data.estado) await setGroupEstado(req.params.id, req.user!.sub, parsed.data.estado);
    res.status(204).send();
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

schedulesRouter.delete("/grupos/:id", async (req, res) => {
  try {
    await deleteGroup(req.params.id, req.user!.sub);
    res.status(204).send();
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

schedulesRouter.delete("/:id/grupo", async (req, res) => {
  await removeFromGroup(req.params.id, req.user!.sub);
  res.status(204).send();
});

const actualizarSchema = z
  .object({
    estado: z.enum(["activa", "pausada"]).optional(),
    nombre: z.string().trim().min(1).max(80).optional(),
    bibliotecaId: z.string().optional(),
    plantaId: z.string().optional(),
    turnos: z.array(z.enum(["manana", "tarde"])).min(1).optional(),
    tipo: z.enum(["n_reservas", "hasta_fecha", "indefinida"]).optional(),
    valorTipoNumero: z.number().int().positive().optional(),
    valorTipoFecha: fechaValida.optional(),
    diasSemana: z.array(z.number().int().min(0).max(6)).min(1).optional(),
    asientosCodigos: z.array(z.string().trim().min(1)).min(1).max(10).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nada que actualizar" });

schedulesRouter.patch("/:id", async (req, res) => {
  const parsed = actualizarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  const { estado, ...resto } = parsed.data;
  try {
    if (estado !== undefined) await setEstado(req.params.id, req.user!.sub, estado);
    if (Object.keys(resto).length > 0) await updateSchedule(req.params.id, req.user!.sub, resto);
    const actualizada = await getSchedule(req.params.id, req.user!.sub);
    if (!actualizada) return res.status(404).json({ error: "Programación no encontrada" });
    res.json(actualizada);
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

schedulesRouter.delete("/:id", async (req, res) => {
  await deleteSchedule(req.params.id, req.user!.sub);
  res.status(204).send();
});

schedulesRouter.get("/:id/activity", async (req, res) => {
  const programacion = await prisma.programacion.findFirst({ where: { id: req.params.id, cuenta: { usuarioId: req.user!.sub } } });
  if (!programacion?.cuentaId) return res.status(404).json({ error: "Programación no encontrada" });
  const items = await listActivity({ cuentaId: programacion.cuentaId, programacionId: programacion.id });
  res.json(items);
});
