import { prisma } from "../db";
import { getPerformances, getSeatMap } from "../patronbase/adapter";
import { PatronBaseSession } from "../patronbase/session";
import { addDays, labelMatchesDate } from "./dateEs";

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

export async function getDisponibilidad(): Promise<DisponibilidadBiblioteca[]> {
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
        try {
          performances = await getPerformances(session, turno.patronbaseProdId);
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
            proximoTexto = primeraTextoBloqueo ?? (primeraDisponible ? primeraDisponible.label : undefined);
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
