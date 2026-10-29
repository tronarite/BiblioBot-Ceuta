import { prisma } from "../db";
import { fechaLocalISO } from "../libraries/dateEs";
import { listReservationsCacheada } from "../reservations/reservations.service";

/**
 * Fallos de reserva que todavía tiene sentido avisar: se descartan los de sesiones que ya
 * pasaron y los de sesiones (día, planta y turno) en las que la cuenta ya tiene una reserva
 * (solo se puede reservar un asiento por sesión, así que no queda nada pendiente).
 */
export async function listFallosVigentes(cuentaIds: string[]) {
  const logs = await prisma.actividadLog.findMany({
    where: { cuentaId: { in: cuentaIds }, tipoEvento: "reserva_fallida" },
    include: { programacion: { include: { biblioteca: true, planta: true } } },
    orderBy: { fecha: "desc" },
    take: 200,
  });

  const hoy = fechaLocalISO(new Date());
  const reservasPorCuenta = new Map<string, Awaited<ReturnType<typeof listReservationsCacheada>>["datos"]>();
  const vigentes = [];
  for (const { programacion, ...log } of logs) {
    if (log.fechaObjetivo && log.fechaObjetivo < hoy) continue;
    if (log.fechaObjetivo && log.turnoTipo && programacion && log.cuentaId) {
      let reservas = reservasPorCuenta.get(log.cuentaId);
      if (!reservas) {
        try {
          reservas = (await listReservationsCacheada(log.cuentaId)).datos;
        } catch {
          reservas = { enCurso: [], proximas: [] }; // sin poder comprobarlo, se mantiene el aviso
        }
        reservasPorCuenta.set(log.cuentaId, reservas);
      }
      const yaReservada = [...reservas.enCurso, ...reservas.proximas].some(
        (r) =>
          r.bibliotecaNombre === programacion.biblioteca.nombre &&
          r.plantaNombre === programacion.planta.nombre &&
          r.turnoTipo === log.turnoTipo &&
          fechaLocalISO(new Date(r.fecha)) === log.fechaObjetivo,
      );
      if (yaReservada) continue;
    }
    vigentes.push(log);
  }
  return vigentes;
}
