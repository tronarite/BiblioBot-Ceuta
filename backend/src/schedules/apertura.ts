import { addDays } from "../libraries/dateEs";

export type TurnoTipo = "manana" | "tarde";

// Hora (zona Europe/Madrid, ver TZ del contenedor) a la que PatronBase abre en la web
// oficial el hueco de reservas de un día para cada turno, EL DÍA ANTERIOR a ese día:
// mañana abre a las 7:00, tarde a las 14:00. Una vez abierto, el hueco sigue reservable
// durante todo el día siguiente (incluido el propio día del turno) hasta que se agote.
export const HORA_APERTURA: Record<TurnoTipo, number> = { manana: 7, tarde: 14 };

// Instante exacto en que se abre el hueco de reservas de fechaObjetivo para un turno:
// el día anterior a las HORA_APERTURA correspondientes. Sirve tanto para "mañana" (el
// hueco de mañana abre hoy) como para "hoy" (el hueco de hoy abrió ayer, luego este
// instante ya quedó atrás y por tanto siempre se considera abierto).
export function instanteApertura(fechaObjetivo: Date, turnoTipo: TurnoTipo): Date {
  const apertura = addDays(fechaObjetivo, -1);
  apertura.setHours(HORA_APERTURA[turnoTipo], 0, 0, 0);
  return apertura;
}
