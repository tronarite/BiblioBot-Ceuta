import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth/auth.middleware";
import { normalizeEmail } from "../auth/auth.service";
import { listReservationsCacheada } from "../reservations/reservations.service";

export const friendsRouter = Router();
friendsRouter.use(requireAuth);

const publico = { id: true, nombre: true, email: true } as const;

async function sonAmigos(a: string, b: string) {
  const f = await prisma.amistad.findFirst({
    where: {
      estado: "aceptada",
      OR: [
        { solicitanteId: a, receptorId: b },
        { solicitanteId: b, receptorId: a },
      ],
    },
  });
  return f;
}

// Amigos, solicitudes recibidas y enviadas, y el ajuste de privacidad propio.
friendsRouter.get("/", async (req, res) => {
  const yo = req.user!.sub;
  const filas = await prisma.amistad.findMany({
    where: { OR: [{ solicitanteId: yo }, { receptorId: yo }] },
    include: { solicitante: { select: publico }, receptor: { select: publico } },
    orderBy: { createdAt: "desc" },
  });
  const amigos = filas
    .filter((f) => f.estado === "aceptada")
    .map((f) => ({ amistadId: f.id, ...(f.solicitanteId === yo ? f.receptor : f.solicitante) }));
  const recibidas = filas
    .filter((f) => f.estado === "pendiente" && f.receptorId === yo)
    .map((f) => ({ amistadId: f.id, ...f.solicitante }));
  const enviadas = filas
    .filter((f) => f.estado === "pendiente" && f.solicitanteId === yo)
    .map((f) => ({ amistadId: f.id, ...f.receptor }));
  const usuario = await prisma.usuario.findUnique({ where: { id: yo }, select: { compartirReservas: true } });
  res.json({ amigos, recibidas, enviadas, compartirReservas: usuario?.compartirReservas ?? true });
});

const solicitudSchema = z.object({ email: z.string().email() });

friendsRouter.post("/solicitud", async (req, res) => {
  const parsed = solicitudSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Email no válido" });
  const yo = req.user!.sub;
  const otro = await prisma.usuario.findUnique({ where: { email: normalizeEmail(parsed.data.email) } });
  if (!otro || !otro.activo) return res.status(404).json({ error: "No hay ningún usuario de BiblioBot con ese email" });
  if (otro.id === yo) return res.status(400).json({ error: "No puedes agregarte a ti mismo" });

  const existente = await prisma.amistad.findFirst({
    where: {
      OR: [
        { solicitanteId: yo, receptorId: otro.id },
        { solicitanteId: otro.id, receptorId: yo },
      ],
    },
  });
  if (existente) {
    if (existente.estado === "aceptada") return res.status(409).json({ error: "Ya sois amigos" });
    // Si la otra persona ya me había enviado una solicitud, se acepta directamente.
    if (existente.receptorId === yo) {
      await prisma.amistad.update({ where: { id: existente.id }, data: { estado: "aceptada" } });
      return res.json({ ok: true, aceptada: true });
    }
    return res.status(409).json({ error: "Ya enviaste una solicitud a esa persona" });
  }
  await prisma.amistad.create({ data: { solicitanteId: yo, receptorId: otro.id } });
  res.status(201).json({ ok: true, aceptada: false });
});

friendsRouter.post("/:id/aceptar", async (req, res) => {
  const f = await prisma.amistad.findUnique({ where: { id: req.params.id } });
  if (!f || f.receptorId !== req.user!.sub || f.estado !== "pendiente") {
    return res.status(404).json({ error: "Solicitud no encontrada" });
  }
  await prisma.amistad.update({ where: { id: f.id }, data: { estado: "aceptada" } });
  res.json({ ok: true });
});

// Rechazar, cancelar una solicitud enviada o quitar a un amigo: es la misma operación.
friendsRouter.delete("/:id", async (req, res) => {
  const yo = req.user!.sub;
  const f = await prisma.amistad.findUnique({ where: { id: req.params.id } });
  if (!f || (f.solicitanteId !== yo && f.receptorId !== yo)) {
    return res.status(404).json({ error: "Amistad no encontrada" });
  }
  await prisma.amistad.delete({ where: { id: f.id } });
  res.status(204).send();
});

const privacidadSchema = z.object({ compartirReservas: z.boolean() });

friendsRouter.patch("/privacidad", async (req, res) => {
  const parsed = privacidadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  await prisma.usuario.update({ where: { id: req.user!.sub }, data: { compartirReservas: parsed.data.compartirReservas } });
  res.json({ compartirReservas: parsed.data.compartirReservas });
});

// Reservas (en curso y próximas) de un amigo: biblioteca, planta, turno y día, nunca el
// asiento ni el enlace a PatronBase. Se leen de su cuenta principal.
friendsRouter.get("/:usuarioId/reservas", async (req, res) => {
  const yo = req.user!.sub;
  const amigoId = req.params.usuarioId;
  if (!(await sonAmigos(yo, amigoId))) return res.status(403).json({ error: "No sois amigos" });
  const amigo = await prisma.usuario.findUnique({ where: { id: amigoId }, select: { compartirReservas: true } });
  if (!amigo?.compartirReservas) return res.json({ compartido: false, reservas: [] });

  const cuenta = await prisma.cuentaPatronBase.findFirst({
    where: { usuarioId: amigoId },
    orderBy: [{ principal: "desc" }, { createdAt: "asc" }],
  });
  if (!cuenta) return res.json({ compartido: true, reservas: [] });
  try {
    const { datos } = await listReservationsCacheada(cuenta.id);
    const reservas = [...datos.enCurso, ...datos.proximas].map((r) => ({
      saleId: r.saleId,
      bibliotecaNombre: r.bibliotecaNombre,
      plantaNombre: r.plantaNombre,
      turnoTipo: r.turnoTipo,
      horario: r.horario,
      fecha: r.fecha,
      estado: r.estado,
    }));
    res.json({ compartido: true, reservas });
  } catch {
    res.status(502).json({ error: "No se pudieron consultar sus reservas ahora mismo" });
  }
});
