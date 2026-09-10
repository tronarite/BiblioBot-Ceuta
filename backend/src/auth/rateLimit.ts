/**
 * Limitador en memoria muy simple (sin dependencias) para frenar la fuerza bruta en el
 * login. Se cuenta por identificador (email/usuario) en vez de por IP: así protege una
 * cuenta concreta sin depender de la configuración de proxies (en producción todo entra
 * por Cloudflare + nginx, con lo que la IP vista por el backend sería siempre la misma).
 * Un intento con éxito limpia el contador. Al reiniciar el proceso se olvida todo.
 */
const VENTANA_MS = 10 * 60 * 1000; // 10 min
const MAX_FALLOS = 8;

const fallos = new Map<string, number[]>();

function normalizar(identificador: string): string {
  return identificador.trim().toLowerCase();
}

/** Devuelve los minutos que faltan para volver a poder intentarlo, o 0 si aún puede. */
export function minutosBloqueado(identificador: string): number {
  const k = normalizar(identificador);
  const ahora = Date.now();
  const recientes = (fallos.get(k) ?? []).filter((t) => ahora - t < VENTANA_MS);
  fallos.set(k, recientes);
  if (recientes.length < MAX_FALLOS) return 0;
  return Math.ceil((VENTANA_MS - (ahora - recientes[0])) / 60000);
}

export function registrarFalloLogin(identificador: string) {
  const k = normalizar(identificador);
  const recientes = (fallos.get(k) ?? []).filter((t) => Date.now() - t < VENTANA_MS);
  recientes.push(Date.now());
  fallos.set(k, recientes);
}

export function limpiarFallosLogin(identificador: string) {
  fallos.delete(normalizar(identificador));
}
