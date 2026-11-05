import type { Request } from "express";

/**
 * Limitador en memoria muy simple (sin dependencias) para frenar la fuerza bruta en el
 * login. Dos contadores por cuenta (email/usuario):
 *  - por cuenta + IP del cliente (8 fallos / 10 min): quien se equivoca solo se bloquea a
 *    sí mismo, así que nadie puede dejar fuera al dueño de una cuenta fallando a propósito;
 *  - por cuenta, sea cual sea la IP (30 fallos / 10 min): tope duro contra la fuerza bruta
 *    repartida entre muchas IPs (o con cabeceras de IP falsificadas).
 * La IP real llega en CF-Connecting-IP (Cloudflare); detrás de nginx, req.ip sería siempre
 * la del proxy. Un intento con éxito limpia los contadores. Al reiniciar se olvida todo.
 */
const VENTANA_MS = 10 * 60 * 1000; // 10 min
const MAX_FALLOS_POR_IP = 8;
const MAX_FALLOS_TOTAL = 30;

const fallos = new Map<string, number[]>();

function normalizar(identificador: string): string {
  return identificador.trim().toLowerCase();
}

export function ipCliente(req: Request): string {
  const cf = req.header("cf-connecting-ip");
  const xff = req.header("x-forwarded-for")?.split(",")[0];
  return (cf || xff || req.ip || "?").trim();
}

function recientes(clave: string): number[] {
  const ahora = Date.now();
  const lista = (fallos.get(clave) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (lista.length) fallos.set(clave, lista);
  else fallos.delete(clave);
  return lista;
}

function minutosRestantes(lista: number[], max: number): number {
  if (lista.length < max) return 0;
  return Math.ceil((VENTANA_MS - (Date.now() - lista[lista.length - max])) / 60000);
}

const claves = (identificador: string, ip: string) => {
  const id = normalizar(identificador);
  return { porIp: `${id}|${ip}`, total: id };
};

/** Devuelve los minutos que faltan para volver a poder intentarlo, o 0 si aún puede. */
export function minutosBloqueado(identificador: string, ip: string): number {
  const k = claves(identificador, ip);
  return Math.max(minutosRestantes(recientes(k.porIp), MAX_FALLOS_POR_IP), minutosRestantes(recientes(k.total), MAX_FALLOS_TOTAL));
}

export function registrarFalloLogin(identificador: string, ip: string) {
  const k = claves(identificador, ip);
  for (const clave of [k.porIp, k.total]) fallos.set(clave, [...recientes(clave), Date.now()]);
}

export function limpiarFallosLogin(identificador: string, ip: string) {
  const k = claves(identificador, ip);
  fallos.delete(k.porIp);
  fallos.delete(k.total);
}
