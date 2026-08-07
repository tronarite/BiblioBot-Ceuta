import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { listActivity } from "./activity.service";

export const activityRouter = Router();
activityRouter.use(requireAuth);

activityRouter.get("/", async (req, res) => {
  const { tipo, programacionId, desde, hasta } = req.query;
  const items = await listActivity({
    usuarioId: req.user!.sub,
    tipoEvento: typeof tipo === "string" ? (tipo as any) : undefined,
    programacionId: typeof programacionId === "string" ? programacionId : undefined,
    desde: typeof desde === "string" ? new Date(desde) : undefined,
    hasta: typeof hasta === "string" ? new Date(hasta) : undefined,
  });
  res.json(items);
});
