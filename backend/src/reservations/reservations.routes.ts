import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/auth.middleware";
import {
  crearReservaPuntual,
  getPerformancesForTurno,
  getSeatMapForTurno,
  listReservationsCacheada,
} from "./reservations.service";

export const reservationsRouter = Router();
reservationsRouter.use(requireAuth);

reservationsRouter.get("/", async (req, res) => {
  try {
    const { datos, actualizadoEn, actualizando } = await listReservationsCacheada(req.user!.sub);
    res.json({ items: datos, actualizadoEn, actualizando });
  } catch (err) {
    console.error("[reservations] fallo al consultar reservas:", err);
    res.status(502).json({ error: (err as Error).message });
  }
});

reservationsRouter.get("/performances", async (req, res) => {
  const turnoId = req.query.turnoId;
  if (typeof turnoId !== "string") return res.status(400).json({ error: "turnoId requerido" });
  try {
    const performances = await getPerformancesForTurno(turnoId);
    res.json(performances);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

reservationsRouter.get("/seatmap", async (req, res) => {
  const { turnoId, perfId } = req.query;
  if (typeof turnoId !== "string" || typeof perfId !== "string") {
    return res.status(400).json({ error: "turnoId y perfId requeridos" });
  }
  try {
    const seatMap = await getSeatMapForTurno(turnoId, perfId);
    res.json(seatMap);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

const seatSchema = z.object({
  sectionId: z.string(),
  areaId: z.string(),
  rowId: z.string(),
  seatId: z.string(),
  seatTypeId: z.string(),
  label: z.string(),
});

const crearSchema = z.object({
  turnoId: z.string(),
  perfId: z.string(),
  fecha: z.string(),
  seat: seatSchema,
});

reservationsRouter.post("/", async (req, res) => {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  try {
    const reserva = await crearReservaPuntual({
      usuarioId: req.user!.sub,
      turnoId: parsed.data.turnoId,
      perfId: parsed.data.perfId,
      fecha: new Date(parsed.data.fecha),
      seat: parsed.data.seat,
    });
    res.status(201).json(reserva);
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});
