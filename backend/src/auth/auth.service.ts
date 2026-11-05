import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../env";

export type JwtPayload = {
  sub: string;
  rol: "admin" | "usuario";
  iat?: number; // segundos; lo añade jsonwebtoken al firmar
};

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.cookieSecure,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Contraseña temporal legible para que un admin la comunique al usuario tras un
// restablecimiento (sin caracteres ambiguos como 0/O, 1/l/I).
export function generarPasswordTemporal(): string {
  const alfabeto = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += alfabeto[randomInt(alfabeto.length)];
  return out;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}

export const AUTH_COOKIE_NAME = "bibliobot_token";

// Los emails se guardan y se buscan siempre en minúsculas: SQLite compara texto de forma
// sensible a mayúsculas por defecto, así que sin esto "Ana@Ejemplo.com" al registrarse y
// "ana@ejemplo.com" al iniciar sesión se tratarían como cuentas distintas.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
