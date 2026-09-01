import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/auth.middleware";
import { listActivity } from "../activity/activity.service";
import { createSchedule, deleteSchedule, getSchedule, listSchedules, setEstado, updateSchedule } from "./schedules.service";

export const schedulesRouter = Router();
schedulesRouter.use(requireAuth);

schedulesRouter.get("/", async (req, res) => {
  const items = await listSchedules(req.user!.sub);
  res.json(items);
});

const crearSchema = z.object({
  nombre: z.string().trim().min(1).max(80).optional(),
  bibliotecaId: z.string(),
  plantaId: z.string(),
  turnos: z.array(z.enum(["manana", "tarde"])).min(1),
  tipo: z.enum(["n_reservas", "hasta_fecha", "indefinida"]),
  valorTipoNumero: z.number().int().positive().optional(),
  valorTipoFecha: z.string().optional(),
  diasSemana: z.array(z.number().int().min(0).max(6)).min(1),
  asientoPreferidoCodigo: z.string().min(1),
  asientoAlternativoCodigo: z.string().optional(),
});

schedulesRouter.post("/", async (req, res) => {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  try {
    const programacion = await createSchedule({ usuarioId: req.user!.sub, ...parsed.data });
    res.status(201).json(programacion);
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
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
    valorTipoFecha: z.string().optional(),
    diasSemana: z.array(z.number().int().min(0).max(6)).min(1).optional(),
    asientoPreferidoCodigo: z.string().min(1).optional(),
    asientoAlternativoCodigo: z.string().optional(),
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
  const items = await listActivity({ usuarioId: req.user!.sub, programacionId: req.params.id });
  res.json(items);
});
