import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { env } from "../env";
import { serializeUsuario } from "../users/serialize";
import { AUTH_COOKIE_NAME, hashPassword, normalizeEmail, signToken, verifyPassword } from "./auth.service";
import { requireAuth } from "./auth.middleware";
import { encryptSecret } from "../crypto/secretBox";
import { login as loginPatronBase } from "../patronbase/adapter";
import { PatronBaseSession } from "../patronbase/session";
import { limpiarFallosLogin, minutosBloqueado, registrarFalloLogin } from "./rateLimit";

export const authRouter = Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.cookieSecure,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

authRouter.get("/status", async (_req, res) => {
  const adminCount = await prisma.usuario.count({ where: { rol: "admin" } });
  res.json({ adminExists: adminCount > 0 });
});

const bootstrapSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

authRouter.post("/bootstrap-admin", async (req, res) => {
  const adminCount = await prisma.usuario.count({ where: { rol: "admin" } });
  if (adminCount > 0) {
    return res.status(409).json({ error: "Ya existe un administrador. Este flujo solo está disponible una vez." });
  }
  const parsed = bootstrapSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  const { nombre, password } = parsed.data;
  const email = normalizeEmail(parsed.data.email);

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese email" });
  }

  const passwordHash = await hashPassword(password);
  const usuario = await prisma.usuario.create({
    data: { nombre, email, passwordHash, rol: "admin" },
  });

  const token = signToken({ sub: usuario.id, rol: "admin" });
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
  res.status(201).json(await serializeUsuario(usuario));
});

const loginSchema = z.object({
  identificador: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  const { identificador, password } = parsed.data;

  const bloqueo = minutosBloqueado(identificador);
  if (bloqueo > 0) {
    return res.status(429).json({ error: `Demasiados intentos fallidos. Prueba de nuevo en ${bloqueo} min.` });
  }

  const usuario =
    (await prisma.usuario.findUnique({ where: { email: normalizeEmail(identificador) } })) ??
    (await prisma.usuario.findUnique({ where: { username: identificador } }));
  const valido = usuario && usuario.activo && (await verifyPassword(password, usuario.passwordHash));
  if (!valido) {
    registrarFalloLogin(identificador);
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  limpiarFallosLogin(identificador);
  const token = signToken({ sub: usuario.id, rol: usuario.rol as "admin" | "usuario" });
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
  res.json(await serializeUsuario(usuario));
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME);
  res.status(204).send();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: req.user!.sub } });
  if (!usuario) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }
  res.json(await serializeUsuario(usuario));
});

// --- Alta por enlace de invitación -------------------------------------------
// El enlace lo genera un administrador (Administración > Invitaciones), es de un solo uso y
// caduca. Quien lo abre crea su propia cuenta con su email y contraseña de PatronBase (se
// validan contra PatronBase antes de crear nada) y queda como amigo de quien lo generó.

async function invitacionVigente(codigo: string) {
  const inv = await prisma.invitacion.findUnique({ where: { codigo }, include: { creador: { select: { nombre: true } } } });
  if (!inv || inv.usadaPorId || inv.expiraEn.getTime() < Date.now()) return null;
  return inv;
}

authRouter.get("/invitacion/:codigo", async (req, res) => {
  const inv = await invitacionVigente(req.params.codigo);
  if (!inv) return res.status(404).json({ error: "Este enlace de invitación no es válido o ha caducado" });
  res.json({ invitadoPor: inv.creador.nombre });
});

const registroSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/registro/:codigo", async (req, res) => {
  const parsed = registroSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  const inv = await invitacionVigente(req.params.codigo);
  if (!inv) return res.status(404).json({ error: "Este enlace de invitación no es válido o ha caducado" });

  const { nombre, password } = parsed.data;
  const email = normalizeEmail(parsed.data.email);
  if (await prisma.usuario.findUnique({ where: { email } })) {
    return res.status(409).json({ error: "Ya existe una cuenta con ese email" });
  }

  const sesion = new PatronBaseSession();
  if (!(await loginPatronBase(sesion, parsed.data.email.trim(), password))) {
    return res.status(422).json({ error: "No se pudo iniciar sesión en PatronBase con esas credenciales" });
  }

  // Reclamar el enlace, crear la cuenta y la amistad es una sola transacción: si algo falla
  // (o el servidor se cae a medias) el enlace queda libre y no se crea nada. El updateMany
  // condicionado impide que dos registros simultáneos usen el mismo enlace.
  const passwordHash = await hashPassword(password);
  let usuario;
  try {
    usuario = await prisma.$transaction(async (tx) => {
      const reclamada = await tx.invitacion.updateMany({
        where: { id: inv.id, usadaPorId: null },
        data: { usadaPorId: "reclamada" },
      });
      if (reclamada.count !== 1) throw new Error("INVITACION_USADA");
      const nuevo = await tx.usuario.create({
        data: {
          nombre,
          email,
          passwordHash,
          rol: "usuario",
          cuentasPatronBase: {
            create: {
              patronbaseEmail: parsed.data.email.trim(),
              credencialesCifrado: encryptSecret(password),
              estadoVinculacion: "vinculada",
              ultimaSincronizacion: new Date(),
              principal: true,
            },
          },
        },
      });
      await tx.invitacion.update({ where: { id: inv.id }, data: { usadaPorId: nuevo.id } });
      await tx.amistad.create({ data: { solicitanteId: inv.creadorId, receptorId: nuevo.id, estado: "aceptada" } });
      return nuevo;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INVITACION_USADA") {
      return res.status(409).json({ error: "Este enlace ya se ha usado" });
    }
    throw err;
  }
  const token = signToken({ sub: usuario.id, rol: "usuario" });
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
  res.status(201).json(await serializeUsuario(usuario));
});
