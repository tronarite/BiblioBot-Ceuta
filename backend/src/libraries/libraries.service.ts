import { prisma } from "../db";
import { getPerformances, getSeatMap } from "../patronbase/adapter";
import { PatronBaseSession } from "../patronbase/session";
import { addDays, labelMatchesDate } from "./dateEs";
import { conCacheSwr } from "./cache";

export async function listBibliotecas() {
  return prisma.biblioteca.findMany({
    include: { plantas: { include: { turnos: true } } },
  });
}

export type EstadoDisponibilidad =
  | "disponible_hoy_manana"
  | "disponible_solo_hoy"
  | "disponible_solo_manana"
  | "no_disponible";

export type DisponibilidadBiblioteca = {
  bibliotecaId: string;
  nombre: string;
  estado: EstadoDisponibilidad;
  proximoDiaDisponibleTexto?: string;
};

async function turnoTieneAsientoLibre(session: PatronBaseSession, prodId: string, perfId: string): Promise<boolean> {
  try {
    const { seats } = await getSeatMap(session, prodId, perfId);
    return seats.some((s) => s.state === "available");
  } catch {
    return false;
  }
}

const TTL_DISPONIBILIDAD_MS = 3 * 60 * 1000; // 3 min: es solo un resumen informativo del dashboard

export async function getDisponibilidadCacheada() {
  return conCacheSwr("disponibilidad", TTL_DISPONIBILIDAD_MS, getDisponibilidadEnVivo);
}

async function getDisponibilidadEnVivo(): Promise<DisponibilidadBiblioteca[]> {
  const bibliotecas = await listBibliotecas();
  const session = new PatronBaseSession();
  const hoy = new Date();
  const manana = addDays(hoy, 1);

  const resultados: DisponibilidadBiblioteca[] = [];

  for (const biblioteca of bibliotecas) {
    let hoyDisponible = false;
    let mananaDisponible = false;
    let proximoTexto: string | undefined;

    for (const planta of biblioteca.plantas) {
      for (const turno of planta.turnos) {
        let performances;
        let noDisponibleTexto: string | null = null;
        try {
          ({ options: performances, noDisponibleTexto } = await getPerformances(session, turno.patronbaseProdId));
        } catch {
          continue;
        }

        const hoyOpt = performances.find((p) => labelMatchesDate(p.label, hoy));
        const mananaOpt = performances.find((p) => labelMatchesDate(p.label, manana));

        if (hoyOpt?.available && !hoyDisponible) {
          hoyDisponible = await turnoTieneAsientoLibre(session, turno.patronbaseProdId, hoyOpt.perfId);
        }
        if (mananaOpt?.available && !mananaDisponible) {
          mananaDisponible = await turnoTieneAsientoLibre(session, turno.patronbaseProdId, mananaOpt.perfId);
        }

        if (!proximoTexto) {
          const primeraDisponible = performances.find((p) => p.available);
          if (!hoyOpt?.available && !mananaOpt?.available) {
            const primeraTextoBloqueo = performances.find((p) => p.availableFromText)?.availableFromText;
            proximoTexto = primeraTextoBloqueo ?? noDisponibleTexto ?? (primeraDisponible ? primeraDisponible.label : undefined);
          }
        }
      }
    }

    let estado: EstadoDisponibilidad;
    if (hoyDisponible && mananaDisponible) estado = "disponible_hoy_manana";
    else if (hoyDisponible) estado = "disponible_solo_hoy";
    else if (mananaDisponible) estado = "disponible_solo_manana";
    else estado = "no_disponible";

    resultados.push({
      bibliotecaId: biblioteca.id,
      nombre: biblioteca.nombre,
      estado,
      proximoDiaDisponibleTexto: estado === "no_disponible" ? proximoTexto : undefined,
    });
  }

  return resultados;
}

export type EstadoTurno = {
  turnoId: string;
  disponibleAhora: boolean;
  mensaje: string | null;
  plazasLibresHoy: number | null;
  pocasPlazasHoy: boolean;
};

const UMBRAL_POCAS_PLAZAS = 5;

/**
 * Para cada turno, indica si hay al menos un día reservable ahora mismo. Cuando no lo
 * hay (la sala está totalmente cerrada por el momento, ni siquiera "hoy" tiene hueco),
 * PatronBase no ofrece ningún día en el selector: solo un aviso de cuándo se abrirá.
 * Se usa para deshabilitar esas opciones en el asistente de reserva y mostrar ese aviso.
 *
 * También calcula, solo para el día de hoy, cuántas plazas quedan libres: si son pocas
 * (<= UMBRAL_POCAS_PLAZAS) se marca pocasPlazasHoy para avisar al elegir turno.
 */
const TTL_TURNOS_ESTADO_MS = 60 * 1000; // 1 min: se usa mientras se elige turno para reservar

export async function getEstadoTurnosCacheado() {
  return conCacheSwr("turnos-estado", TTL_TURNOS_ESTADO_MS, getEstadoTurnosEnVivo);
}

async function getEstadoTurnosEnVivo(): Promise<EstadoTurno[]> {
  const bibliotecas = await listBibliotecas();
  const turnos = bibliotecas.flatMap((b) => b.plantas.flatMap((p) => p.turnos));
  const hoy = new Date();

  // Peticiones públicas e independientes entre sí: una sesión por turno para poder
  // consultarlas todas en paralelo sin compartir estado de cookies innecesariamente.
  return Promise.all(
    turnos.map(async (turno): Promise<EstadoTurno> => {
      try {
        const session = new PatronBaseSession();
        const { options, noDisponibleTexto } = await getPerformances(session, turno.patronbaseProdId);
        const hayAlguno = options.some((o) => o.available);

        let plazasLibresHoy: number | null = null;
        const hoyOpt = options.find((o) => labelMatchesDate(o.label, hoy));
        if (hoyOpt?.available) {
          try {
            const { seats } = await getSeatMap(session, turno.patronbaseProdId, hoyOpt.perfId);
            plazasLibresHoy = seats.filter((s) => s.state === "available").length;
          } catch {
            plazasLibresHoy = null;
          }
        }

        return {
          turnoId: turno.id,
          disponibleAhora: hayAlguno,
          mensaje: hayAlguno ? null : (noDisponibleTexto ?? options.find((o) => o.availableFromText)?.availableFromText ?? null),
          plazasLibresHoy,
          pocasPlazasHoy: plazasLibresHoy !== null && plazasLibresHoy > 0 && plazasLibresHoy <= UMBRAL_POCAS_PLAZAS,
        };
      } catch {
        return {
          turnoId: turno.id,
          disponibleAhora: false,
          mensaje: "No se pudo consultar la disponibilidad",
          plazasLibresHoy: null,
          pocasPlazasHoy: false,
        };
      }
    }),
  );
}
