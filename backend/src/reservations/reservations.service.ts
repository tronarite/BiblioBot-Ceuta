import { prisma } from "../db";
import { env } from "../env";
import { logActivity } from "../activity/activity.service";
import { getAuthenticatedSession } from "../patronbaseAccount/account.service";
import {
  confirmSeats,
  getCart,
  getPerformances,
  getSaleDetail,
  getSalesHistory,
  getSeatMap,
  holdSeat,
  checkout as patronbaseCheckout,
} from "../patronbase/adapter";
import { PatronBaseSession } from "../patronbase/session";
import { withAccountLock } from "../patronbase/accountLock";
import { addDays, parseSpanishDate, startOfDay } from "../libraries/dateEs";
import { conCacheSwr, invalidarCache } from "../libraries/cache";

export type ReservaPatronBase = {
  saleId: string;
  bibliotecaNombre: string;
  plantaNombre: string;
  turnoTipo: "manana" | "tarde" | null;
  horario: string | null;
  fecha: string;
  horaSesion: string;
  asiento: string;
  estado: "en_curso" | "proxima";
  enlacePatronBase: string;
};

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function extraerNombreEntreComillas(texto: string): string | null {
  const match = texto.match(/"([^"]+)"/);
  return match ? normalizarTexto(match[1]) : null;
}

/**
 * Franja horaria aproximada de cada turno, para poder decidir si "hoy" está realmente
 * en curso ahora mismo o si todavía es una sesión futura del mismo día (ej. una reserva
 * de tarde no está "en curso" a media mañana). El horario exacto de cierre varía por
 * sede ("hasta la hora de cierre"), así que se usa un margen amplio para no descartar
 * sesiones de tarde que sigan abiertas.
 */
const FRANJA_HORARIA: Record<"manana" | "tarde", { desde: number; hasta: number }> = {
  manana: { desde: 9, hasta: 15 },
  tarde: { desde: 15, hasta: 21.5 },
};

function horaDecimal(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

function estadoSesionHoy(turnoTipo: "manana" | "tarde" | null, ahora: Date): "en_curso" | "proxima" | "finalizada" {
  if (!turnoTipo) return "en_curso";
  const franja = FRANJA_HORARIA[turnoTipo];
  const hora = horaDecimal(ahora);
  if (hora < franja.desde) return "proxima";
  if (hora >= franja.hasta) return "finalizada";
  return "en_curso";
}

async function resolverTurno(tituloProduccion: string) {
  const normalizado = normalizarTexto(tituloProduccion);

  const tipo: "manana" | "tarde" | null = normalizado.includes("manana")
    ? "manana"
    : normalizado.includes("tarde")
      ? "tarde"
      : null;
  if (!tipo) return null;

  const bibliotecas = await prisma.biblioteca.findMany({ include: { plantas: { include: { turnos: true } } } });
  const biblioteca = bibliotecas.find((b) => {
    const nombreCorto = extraerNombreEntreComillas(b.nombre);
    return nombreCorto && normalizado.includes(nombreCorto);
  });
  if (!biblioteca) return null;

  let planta = biblioteca.plantas[0];
  if (biblioteca.plantas.length > 1) {
    const numeroMatch = normalizado.match(/p\.?\s*(\d+)/);
    const encontrada = numeroMatch
      ? biblioteca.plantas.find((p) => p.nombre.includes(numeroMatch[1]))
      : biblioteca.plantas.find((p) => normalizado.includes(normalizarTexto(p.nombre)));
    if (!encontrada) return null;
    planta = encontrada;
  }

  const turno = planta.turnos.find((t) => t.tipo === tipo);
  if (!turno) return null;

  return { biblioteca, planta, turno };
}

/**
 * Lee directamente el historial de compras de la cuenta PatronBase vinculada (no la
 * tabla local Reserva) para que "en curso"/"próximas" reflejen siempre el estado real
 * de la cuenta, se haya reservado desde BiblioBot o directamente en PatronBase.
 * Solo hace falta mirar compras de hoy/ayer: la ventana de reserva de PatronBase nunca
 * permite comprar con más de un día de antelación, así que cualquier sesión futura o en
 * curso viene necesariamente de una compra hecha hoy o ayer.
 */
export async function listReservations(usuarioId: string): Promise<{ enCurso: ReservaPatronBase[]; proximas: ReservaPatronBase[] }> {
  const cuenta = await prisma.cuentaPatronBase.findUnique({ where: { usuarioId } });
  if (!cuenta || cuenta.estadoVinculacion !== "vinculada") {
    return { enCurso: [], proximas: [] };
  }

  const session = await getAuthenticatedSession(usuarioId);
  const historial = await getSalesHistory(session);

  const hoy = startOfDay(new Date());
  const ayer = addDays(hoy, -1);

  const candidatas = historial.filter((h) => {
    const fechaCompra = parseSpanishDate(h.fecha);
    return fechaCompra !== null && fechaCompra.getTime() >= ayer.getTime();
  });

  const resultados: ReservaPatronBase[] = [];
  for (const compra of candidatas) {
    const items = await getSaleDetail(session, compra.saleId);
    for (const item of items) {
      const fechaSesion = parseSpanishDate(item.fechaSesionTexto);
      if (!fechaSesion || fechaSesion.getTime() < hoy.getTime()) continue;

      const resuelto = await resolverTurno(item.tituloProduccion);
      const turnoTipo: "manana" | "tarde" | null =
        resuelto?.turno.tipo === "manana" || resuelto?.turno.tipo === "tarde" ? resuelto.turno.tipo : null;

      let estado: "en_curso" | "proxima";
      if (fechaSesion.getTime() > hoy.getTime()) {
        estado = "proxima";
      } else {
        const estadoHoy = estadoSesionHoy(turnoTipo, new Date());
        if (estadoHoy === "finalizada") continue; // la sesión de hoy ya terminó, no se muestra
        estado = estadoHoy;
      }

      resultados.push({
        saleId: compra.saleId,
        bibliotecaNombre: resuelto?.biblioteca.nombre ?? item.tituloProduccion.replace(/^B\.P\.\s*/i, ""),
        plantaNombre: resuelto?.planta.nombre ?? item.sala,
        turnoTipo,
        horario: resuelto?.turno.horario ?? null,
        fecha: fechaSesion.toISOString(),
        horaSesion: item.horaSesion,
        asiento: item.asiento,
        estado,
        enlacePatronBase: `${env.patronbaseBaseUrl}/Patron/ViewSale?sale=${encodeURIComponent(compra.saleId)}`,
      });
    }
  }

  resultados.sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    enCurso: resultados.filter((r) => r.estado === "en_curso"),
    proximas: resultados.filter((r) => r.estado === "proxima"),
  };
}

const TTL_RESERVAS_MS = 90 * 1000;
const claveReservas = (usuarioId: string) => `reservas:${usuarioId}`;

/**
 * Versión cacheada (stale-while-revalidate, persistida) de listReservations: leer el
 * historial de PatronBase implica varias peticiones scrapeadas y tarda. Con la caché, al
 * entrar al dashboard se ven al instante las reservas de la última vez y se refrescan en
 * segundo plano. Se invalida al crear una reserva (manual o del motor) para no mostrar
 * datos viejos justo después.
 */
export async function listReservationsCacheada(usuarioId: string) {
  return conCacheSwr(claveReservas(usuarioId), TTL_RESERVAS_MS, () => listReservations(usuarioId));
}

export function invalidarReservas(usuarioId: string) {
  invalidarCache(claveReservas(usuarioId));
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

    invalidarReservas(params.usuarioId);
    return reserva;
  });
}
