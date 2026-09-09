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

export type ResultadoCacheado<T> = {
  datos: T;
  actualizadoEn: string; // ISO
  actualizando: boolean;
};

/**
 * Caché en memoria "stale-while-revalidate" para endpoints de solo lectura que consultan
 * PatronBase en vivo (disponibilidad general, estado de turnos): si el dato en caché
 * sigue "fresco" (dentro de ttlFrescoMs) se devuelve tal cual, sin tocar PatronBase. Si
 * está desactualizado se devuelve igualmente al momento (respuesta rápida, sin bloquear
 * al usuario) y se refresca en segundo plano para que la siguiente consulta ya vea el
 * dato nuevo si cambió. Solo hay scraping bloqueante la primera vez que se pide algo
 * (arranque del servidor, todavía sin nada en caché).
 *
 * No usar esto para nada que decida el resultado de una reserva real (mapa de asientos,
 * checkout): eso debe pedirse siempre en vivo, justo antes de retener/confirmar el asiento.
 */
export async function conCacheSwr<T>(
  clave: string,
  ttlFrescoMs: number,
  obtener: () => Promise<T>,
): Promise<ResultadoCacheado<T>> {
  const entrada = cache.get(clave) as Entrada<T> | undefined;

  if (!entrada) {
    const datos = await obtenerDeduplicado(clave, obtener);
    cache.set(clave, { datos, actualizadoEn: Date.now() });
    return { datos, actualizadoEn: new Date().toISOString(), actualizando: false };
  }

  const fresco = Date.now() - entrada.actualizadoEn < ttlFrescoMs;
  if (!fresco) {
    obtenerDeduplicado(clave, obtener)
      .then((datos) => cache.set(clave, { datos, actualizadoEn: Date.now() }))
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
