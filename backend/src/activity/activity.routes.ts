import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, requireCuenta } from "../auth/auth.middleware";
import { listActivity } from "./activity.service";

export const activityRouter = Router();
activityRouter.use(requireAuth, requireCuenta);

activityRouter.get("/", async (req, res) => {
  const { tipo, programacionId, desde, hasta } = req.query;
  if (!req.cuentaId) return res.json([]);
  const cuentaId = req.todasCuentas
    ? (await prisma.cuentaPatronBase.findMany({ where: { usuarioId: req.user!.sub }, select: { id: true } })).map((c) => c.id)
    : req.cuentaId;
  const items = await listActivity({
    cuentaId,
    tipoEvento: typeof tipo === "string" ? (tipo as any) : undefined,
    programacionId: typeof programacionId === "string" ? programacionId : undefined,
    desde: typeof desde === "string" ? new Date(desde) : undefined,
    hasta: typeof hasta === "string" ? new Date(hasta) : undefined,
  });
  res.json(items);
});
