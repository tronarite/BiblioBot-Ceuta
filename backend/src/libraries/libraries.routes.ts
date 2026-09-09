import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { getDisponibilidadCacheada, getEstadoTurnosCacheado, listBibliotecas } from "./libraries.service";

export const librariesRouter = Router();
librariesRouter.use(requireAuth);

librariesRouter.get("/", async (_req, res) => {
  const bibliotecas = await listBibliotecas();
  res.json(bibliotecas);
});

librariesRouter.get("/disponibilidad", async (_req, res) => {
  const { datos, actualizadoEn, actualizando } = await getDisponibilidadCacheada();
  res.json({ items: datos, actualizadoEn, actualizando });
});

librariesRouter.get("/turnos-estado", async (_req, res) => {
  const { datos, actualizadoEn, actualizando } = await getEstadoTurnosCacheado();
  res.json({ items: datos, actualizadoEn, actualizando });
});
