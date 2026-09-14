/**
 * Los campos ultimaFechaReservada{Manana,Tarde} y ultimaFechaFallida{Manana,Tarde} de
 * Programacion guardan un JSON array de fechas (YYYY-MM-DD), no una sola fecha: el
 * motor evalúa "hoy" y "mañana" como fechas objetivo en el mismo tick (ver engine.ts),
 * así que un solo valor escalar por turno hacía que ambas fechas se pisaran entre sí
 * de un tick a otro — provocando avisos repetidos sin parar y, en el peor caso, el
 * riesgo de reintentar (y duplicar) una reserva ya conseguida.
 */
export function leerFechas(valor: string | null): string[] {
  if (!valor) return [];
  try {
    const parsed = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    // Compatibilidad con el formato anterior (una sola fecha como string plano).
    return [valor];
  }
}

/**
 * Añade `fecha` al conjunto guardado en `valor` y poda cualquier fecha ya pasada (solo
 * hace falta recordar "hoy" y "mañana" como mucho, así el campo no crece sin límite).
 */
export function agregarFecha(valor: string | null, fecha: string): string {
  const fechas = leerFechas(valor);
  if (!fechas.includes(fecha)) fechas.push(fecha);
  const hoyStr = new Date().toISOString().slice(0, 10);
  return JSON.stringify(fechas.filter((f) => f >= hoyStr));
}
