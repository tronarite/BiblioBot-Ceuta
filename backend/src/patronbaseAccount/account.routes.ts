import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireCuenta } from "../auth/auth.middleware";
import { addCuenta, listCuentas, removeCuenta, retryLink, updateCuenta } from "./account.service";

export const patronbaseAccountRouter = Router();
patronbaseAccountRouter.use(requireAuth);

// Estado de la cuenta activa (compatibilidad con la pantalla Cuenta actual).
patronbaseAccountRouter.get("/", requireCuenta, async (req, res) => {
  const cuentas = await listCuentas(req.user!.sub);
  const activa = cuentas.find((c) => c.id === req.cuentaId);
  if (!activa) return res.json({ estadoVinculacion: "no_vinculada", patronbaseEmail: null });
  res.json({ estadoVinculacion: activa.estadoVinculacion, patronbaseEmail: activa.patronbaseEmail });
});

patronbaseAccountRouter.get("/cuentas", async (req, res) => {
  res.json(await listCuentas(req.user!.sub));
});

const linkSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  alias: z.string().trim().max(40).optional(),
});

// La primera cuenta que se añade es la principal; las siguientes, secundarias.
async function crearCuenta(req: import("express").Request, res: import("express").Response) {
  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  const result = await addCuenta(req.user!.sub, parsed.data.email, parsed.data.password, parsed.data.alias);
  if (!result.ok) {
    return res.status(422).json({ error: result.error });
  }
  res.status(201).json({ estadoVinculacion: "vinculada", cuentaId: result.cuenta.id });
}
patronbaseAccountRouter.post("/cuentas", crearCuenta);
patronbaseAccountRouter.post("/link", crearCuenta);

const ajustesSchema = z.object({
  alias: z.string().trim().max(40).nullable().optional(),
  modoReservas: z.enum(["esta", "todas", "seleccionadas"]).optional(),
  reservasDeCuentas: z.array(z.string()).max(10).optional(),
});

patronbaseAccountRouter.patch("/cuentas/:id", async (req, res) => {
  const parsed = ajustesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  const cuenta = await updateCuenta(req.user!.sub, req.params.id, parsed.data);
  if (!cuenta) return res.status(404).json({ error: "Cuenta no encontrada" });
  res.json(cuenta);
});

patronbaseAccountRouter.delete("/cuentas/:id", async (req, res) => {
  const result = await removeCuenta(req.user!.sub, req.params.id);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.status(204).send();
});

patronbaseAccountRouter.post("/cuentas/:id/retry", async (req, res) => {
  const result = await retryLink(req.user!.sub, req.params.id);
  if (!result.ok) {
    return res.status(422).json({ error: result.error });
  }
  res.json({ estadoVinculacion: "vinculada" });
});

// Compatibilidad: reintentar la cuenta activa.
patronbaseAccountRouter.post("/retry", requireCuenta, async (req, res) => {
  if (!req.cuentaId) return res.status(404).json({ error: "No hay ninguna cuenta PatronBase vinculada" });
  const result = await retryLink(req.user!.sub, req.cuentaId);
  if (!result.ok) {
    return res.status(422).json({ error: result.error });
  }
  res.json({ estadoVinculacion: "vinculada" });
});

// Compatibilidad: desvincular la cuenta activa.
patronbaseAccountRouter.delete("/link", requireCuenta, async (req, res) => {
  if (!req.cuentaId) return res.status(204).send();
  const result = await removeCuenta(req.user!.sub, req.cuentaId);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.status(204).send();
});
