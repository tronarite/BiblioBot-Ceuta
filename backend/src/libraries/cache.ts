import { prisma } from "../db";

type Entrada<T> = { datos: T; actualizadoEn: number };

const cache = new Map<string, Entrada<unknown>>();
const enVuelo = new Map<string, Promise<unknown>>();

// Evita que varias peticiones simultáneas (p. ej. dos pestañas recargando a la vez, o el
// primer arranque del servidor) disparen el mismo scraping por duplicado: todas comparten
// la misma promesa en curso.
function obtenerDeduplicado<T>(clave: string, obtener: () => Promise<T>): Promise<T> {
  const existente = enVuelo.get(clave) as Promise<T> | undefined;
  if (existente) return existente;
  const promesa = obtener().finally(() => enVuelo.delete(clave));
  enVuelo.set(clave, promesa);
  return promesa;
}

function guardar<T>(clave: string, datos: T, actualizadoEn: number) {
  cache.set(clave, { datos, actualizadoEn });
  // Persistencia best-effort: si falla la escritura en DB, la caché en memoria sigue valiendo.
  prisma.cacheEntry
    .upsert({
      where: { clave },
      update: { datos: JSON.stringify(datos), actualizadoEn: new Date(actualizadoEn) },
      create: { clave, datos: JSON.stringify(datos), actualizadoEn: new Date(actualizadoEn) },
    })
    .catch(() => {});
}

async function cargarDeDb<T>(clave: string): Promise<Entrada<T> | null> {
  try {
    const fila = await prisma.cacheEntry.findUnique({ where: { clave } });
    if (!fila) return null;
    const entrada: Entrada<T> = { datos: JSON.parse(fila.datos) as T, actualizadoEn: fila.actualizadoEn.getTime() };
    cache.set(clave, entrada);
    return entrada;
  } catch {
    return null;
  }
}

export type ResultadoCacheado<T> = {
  datos: T;
  actualizadoEn: string; // ISO
  actualizando: boolean;
};

/**
 * Caché "stale-while-revalidate" (en memoria + persistida en DB) para endpoints de solo
 * lectura que consultan PatronBase en vivo (disponibilidad general, estado de turnos):
 * si el dato en caché sigue "fresco" (dentro de ttlFrescoMs) se devuelve tal cual, sin
 * tocar PatronBase. Si está desactualizado se devuelve igualmente al momento (respuesta
 * rápida) y se refresca en segundo plano. Como la caché se guarda en DB, tras un
 * reinicio/despliegue la primera carga sigue siendo instantánea (dato algo viejo) en
 * lugar de esperar ~15 s al scraping completo.
 *
 * No usar esto para nada que decida el resultado de una reserva real (mapa de asientos,
 * checkout): eso debe pedirse siempre en vivo, justo antes de retener/confirmar el asiento.
 */
export async function conCacheSwr<T>(
  clave: string,
  ttlFrescoMs: number,
  obtener: () => Promise<T>,
): Promise<ResultadoCacheado<T>> {
  const entrada = (cache.get(clave) as Entrada<T> | undefined) ?? (await cargarDeDb<T>(clave));

  if (!entrada) {
    const datos = await obtenerDeduplicado(clave, obtener);
    const ahora = Date.now();
    guardar(clave, datos, ahora);
    return { datos, actualizadoEn: new Date(ahora).toISOString(), actualizando: false };
  }

  const fresco = Date.now() - entrada.actualizadoEn < ttlFrescoMs;
  if (!fresco) {
    obtenerDeduplicado(clave, obtener)
      .then((datos) => guardar(clave, datos, Date.now()))
      .catch(() => {
        /* se reintenta en la próxima consulta */
      });
  }

  return {
    datos: entrada.datos,
    actualizadoEn: new Date(entrada.actualizadoEn).toISOString(),
    actualizando: !fresco,
  };
}
