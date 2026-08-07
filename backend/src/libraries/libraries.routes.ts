import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { getDisponibilidad, listBibliotecas } from "./libraries.service";

export const librariesRouter = Router();
librariesRouter.use(requireAuth);

librariesRouter.get("/", async (_req, res) => {
  const bibliotecas = await listBibliotecas();
  res.json(bibliotecas);
});

librariesRouter.get("/disponibilidad", async (_req, res) => {
  const disponibilidad = await getDisponibilidad();
  res.json(disponibilidad);
});
