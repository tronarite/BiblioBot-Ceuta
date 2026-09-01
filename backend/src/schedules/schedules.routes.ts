import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/auth.middleware";
import { listActivity } from "../activity/activity.service";
import { createSchedule, deleteSchedule, listSchedules, renombrarSchedule, setEstado } from "./schedules.service";

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

const estadoSchema = z
  .object({
    estado: z.enum(["activa", "pausada"]).optional(),
    nombre: z.string().trim().min(1).max(80).optional(),
  })
  .refine((data) => data.estado !== undefined || data.nombre !== undefined, { message: "Nada que actualizar" });

schedulesRouter.patch("/:id", async (req, res) => {
  const parsed = estadoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  if (parsed.data.estado !== undefined) await setEstado(req.params.id, req.user!.sub, parsed.data.estado);
  if (parsed.data.nombre !== undefined) await renombrarSchedule(req.params.id, req.user!.sub, parsed.data.nombre);
  res.status(204).send();
});

schedulesRouter.delete("/:id", async (req, res) => {
  await deleteSchedule(req.params.id, req.user!.sub);
  res.status(204).send();
});

schedulesRouter.get("/:id/activity", async (req, res) => {
  const items = await listActivity({ usuarioId: req.user!.sub, programacionId: req.params.id });
  res.json(items);
});
