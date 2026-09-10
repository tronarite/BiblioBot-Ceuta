import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { env } from "../env";
import { serializeUsuario } from "../users/serialize";
import { AUTH_COOKIE_NAME, hashPassword, normalizeEmail, signToken, verifyPassword } from "./auth.service";
import { requireAuth } from "./auth.middleware";
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
