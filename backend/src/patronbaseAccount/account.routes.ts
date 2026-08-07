import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/auth.middleware";
import { getStatus, linkAccount, unlinkAccount } from "./account.service";

export const patronbaseAccountRouter = Router();
patronbaseAccountRouter.use(requireAuth);

patronbaseAccountRouter.get("/", async (req, res) => {
  const status = await getStatus(req.user!.sub);
  res.json(status);
});

const linkSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

patronbaseAccountRouter.post("/link", async (req, res) => {
  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  const result = await linkAccount(req.user!.sub, parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return res.status(422).json({ error: result.error });
  }
  res.status(201).json({ estadoVinculacion: "vinculada" });
});

patronbaseAccountRouter.delete("/link", async (req, res) => {
  await unlinkAccount(req.user!.sub);
  res.status(204).send();
});
