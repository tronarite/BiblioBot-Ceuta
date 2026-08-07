import { prisma } from "../db";
import { logActivity } from "../activity/activity.service";
import { getAuthenticatedSession } from "../patronbaseAccount/account.service";
import {
  confirmSeats,
  getCart,
  getPerformances,
  getSeatMap,
  holdSeat,
  checkout as patronbaseCheckout,
} from "../patronbase/adapter";
import { PatronBaseSession } from "../patronbase/session";
import { withAccountLock } from "../patronbase/accountLock";

export async function listReservations(usuarioId: string) {
  const reservas = await prisma.reserva.findMany({
    where: { usuarioId, estado: { in: ["en_curso", "proxima"] } },
    include: { biblioteca: true, planta: true, turno: true },
    orderBy: { fecha: "asc" },
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const enCurso = reservas.filter((r) => r.fecha >= hoy && r.fecha < manana);
  const proximas = reservas.filter((r) => r.fecha >= manana);

  return { enCurso, proximas };
}

export async function getPerformancesForTurno(turnoId: string) {
  const turno = await prisma.turno.findUnique({ where: { id: turnoId } });
  if (!turno) throw new Error("Turno no encontrado");
  const session = new PatronBaseSession();
  return getPerformances(session, turno.patronbaseProdId);
}

export async function getSeatMapForTurno(turnoId: string, perfId: string) {
  const turno = await prisma.turno.findUnique({ where: { id: turnoId } });
  if (!turno) throw new Error("Turno no encontrado");
  const session = new PatronBaseSession();
  return getSeatMap(session, turno.patronbaseProdId, perfId);
}

type SeatSelection = {
  sectionId: string;
  areaId: string;
  rowId: string;
  seatId: string;
  seatTypeId: string;
  label: string;
};

export async function crearReservaPuntual(params: {
  usuarioId: string;
  turnoId: string;
  perfId: string;
  fecha: Date;
  seat: SeatSelection;
}) {
  const turno = await prisma.turno.findUnique({ where: { id: params.turnoId }, include: { planta: true } });
  if (!turno) throw new Error("Turno no encontrado");

  const cuenta = await prisma.cuentaPatronBase.findUnique({ where: { usuarioId: params.usuarioId } });
  if (!cuenta) throw new Error("No tienes una cuenta PatronBase vinculada");

  return withAccountLock(cuenta.id, async () => {
    const session = await getAuthenticatedSession(params.usuarioId);

    // Importante: el confirmHref se obtiene de ESTA carga del mapa, la misma que
    // precede al hold. Volver a pedir el mapa después de retener el asiento resetea
    // la retención en PatronBase, así que no se debe repetir esta llamada tras holdSeat.
    const { confirmHref } = await getSeatMap(session, turno.patronbaseProdId, params.perfId);

    const held = await holdSeat(session, turno.patronbaseProdId, params.perfId, params.seat);
    if (!held) {
      await logActivity({
        usuarioId: params.usuarioId,
        tipoEvento: "reserva_fallida",
        mensaje: `No se pudo retener el asiento ${params.seat.label} en ${turno.planta.nombre}`,
      });
      throw new Error("El asiento seleccionado ya no está disponible");
    }

    if (confirmHref) {
      await confirmSeats(session, confirmHref);
    }

    const cart = await getCart(session);
    if (cart.isEmpty || !cart.checkoutAction) {
      await logActivity({
        usuarioId: params.usuarioId,
        tipoEvento: "reserva_fallida",
        mensaje: `La cesta quedó vacía al intentar reservar ${params.seat.label}`,
      });
      throw new Error("No se pudo completar la reserva: la cesta quedó vacía");
    }

    const saleId = await patronbaseCheckout(session, cart.checkoutAction);
    if (!saleId) {
      await logActivity({
        usuarioId: params.usuarioId,
        tipoEvento: "reserva_fallida",
        mensaje: `El checkout de ${params.seat.label} no devolvió número de pedido; puede no haberse completado`,
      });
      throw new Error("No se pudo confirmar la reserva en PatronBase (no se obtuvo número de pedido)");
    }

    const reserva = await prisma.reserva.create({
      data: {
        usuarioId: params.usuarioId,
        bibliotecaId: turno.planta.bibliotecaId,
        plantaId: turno.plantaId,
        turnoId: turno.id,
        asientoCodigo: params.seat.label,
        fecha: params.fecha,
        estado: "proxima",
        origen: "manual",
        patronbaseSaleId: saleId ?? undefined,
      },
    });

    await logActivity({
      usuarioId: params.usuarioId,
      tipoEvento: "reserva_exitosa",
      mensaje: `Reserva confirmada: ${params.seat.label} en ${turno.planta.nombre} (${turno.tipo})`,
    });

    return reserva;
  });
}
