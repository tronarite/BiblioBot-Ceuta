import cron from "node-cron";
import { prisma } from "../db";
import { env } from "../env";
import { logActivity } from "../activity/activity.service";
import { getAuthenticatedSession } from "../patronbaseAccount/account.service";
import { coincideAsiento, confirmSeats, getCart, getPerformances, getSeatMap, holdSeat, checkout as patronbaseCheckout } from "../patronbase/adapter";
import { addDays, formatearFechaEs, labelMatchesDate } from "../libraries/dateEs";
import { invalidarReservas } from "../reservations/reservations.service";
import { diaTurnoPermitido } from "./rules";
import { calcularProximaEjecucion } from "./schedules.service";
import type { Prisma } from "@prisma/client";

type ProgramacionConRelaciones = Prisma.ProgramacionGetPayload<{
  include: { biblioteca: true; planta: { include: { turnos: true } }; usuario: true };
}>;

type TurnoTipo = "manana" | "tarde";

// Hora (zona Europe/Madrid, ver TZ del contenedor) a la que PatronBase abre en la web
// oficial el hueco de reservas de un día para cada turno, EL DÍA ANTERIOR a ese día:
// mañana abre a las 7:00, tarde a las 14:00. Una vez abierto, el hueco sigue reservable
// durante todo el día siguiente (incluido el propio día del turno) hasta que se agote.
const HORA_APERTURA: Record<TurnoTipo, number> = { manana: 7, tarde: 14 };

// Instante exacto en que se abre el hueco de reservas de fechaObjetivo para un turno:
// el día anterior a las HORA_APERTURA correspondientes. Sirve tanto para "mañana" (el
// hueco de mañana abre hoy) como para "hoy" (el hueco de hoy abrió ayer, luego este
// instante ya quedó atrás y por tanto siempre se considera abierto).
function instanteApertura(fechaObjetivo: Date, turnoTipo: TurnoTipo): Date {
  const apertura = addDays(fechaObjetivo, -1);
  apertura.setHours(HORA_APERTURA[turnoTipo], 0, 0, 0);
  return apertura;
}

const CAMPO_EXITO: Record<TurnoTipo, "ultimaFechaReservadaManana" | "ultimaFechaReservadaTarde"> = {
  manana: "ultimaFechaReservadaManana",
  tarde: "ultimaFechaReservadaTarde",
};

const CAMPO_FALLO: Record<TurnoTipo, "ultimaFechaFallidaManana" | "ultimaFechaFallidaTarde"> = {
  manana: "ultimaFechaFallidaManana",
  tarde: "ultimaFechaFallidaTarde",
};

// Lista ordenada de nº de asiento a intentar. Fuente de verdad: asientosCodigos (JSON
// array). Fallback a las columnas legacy por si alguna programación antigua no se migró.
function codigosDeAsiento(p: { asientosCodigos: string; asientoPreferidoCodigo: string | null; asientoAlternativoCodigo: string | null }): string[] {
  try {
    const lista = JSON.parse(p.asientosCodigos) as string[];
    if (Array.isArray(lista) && lista.length > 0) return lista.filter(Boolean);
  } catch {
    /* cae al fallback */
  }
  return [p.asientoPreferidoCodigo, p.asientoAlternativoCodigo].filter((c): c is string => Boolean(c));
}

// El motor pasa por todas las programaciones activas cada minuto, pero solo tiene
// sentido golpear PatronBase de verdad cada SCHEDULE_RETRY_DELAY_MINUTES por
// programación+turno mientras el hueco siga sin abrirse o sin sitio. Vive solo en
// memoria: tras un reinicio del proceso simplemente se reintenta en el siguiente tick,
// lo cual es inofensivo (nunca se pierde un intento, como sí pasaba con el timeout
// único de antes).
const ultimoIntentoEnMemoria = new Map<string, number>();

function debeIntentarAhora(clave: string): boolean {
  const ahora = Date.now();
  const anterior = ultimoIntentoEnMemoria.get(clave);
  if (anterior !== undefined && ahora - anterior < env.scheduleRetryDelayMinutes * 60 * 1000) return false;
  ultimoIntentoEnMemoria.set(clave, ahora);
  return true;
}

async function intentarTurno(
  programacion: ProgramacionConRelaciones,
  turnoTipo: TurnoTipo,
  fechaObjetivo: Date,
): Promise<{ exito: boolean; motivo: string; asientosComprobados?: boolean }> {
  const turno = programacion.planta.turnos.find((t) => t.tipo === turnoTipo);
  if (!turno) return { exito: false, motivo: `La planta no tiene turno de ${turnoTipo}` };

  const check = diaTurnoPermitido({
    biblioteca: programacion.biblioteca,
    planta: programacion.planta,
    turnoTipo,
    diaSemana: fechaObjetivo.getDay(),
  });
  if (!check.permitido) return { exito: false, motivo: check.motivo ?? "Combinación no permitida" };

  let session;
  try {
    session = await getAuthenticatedSession(programacion.usuarioId);
  } catch (err) {
    return { exito: false, motivo: `No se pudo autenticar en PatronBase: ${(err as Error).message}` };
  }

  const { options: performances } = await getPerformances(session, turno.patronbaseProdId);
  const objetivo = performances.find((p) => labelMatchesDate(p.label, fechaObjetivo));
  if (!objetivo || !objetivo.available) {
    return { exito: false, motivo: "El hueco para ese día todavía no está abierto en PatronBase" };
  }

  const { seats, confirmHref } = await getSeatMap(session, turno.patronbaseProdId, objetivo.perfId);

  const candidatos = codigosDeAsiento(programacion);

  for (const codigo of candidatos) {
    const asiento = seats.find((s) => coincideAsiento(codigo, s) && s.state === "available");
    if (!asiento) continue;

    const held = await holdSeat(session, turno.patronbaseProdId, objetivo.perfId, asiento);
    if (!held) continue;

    if (confirmHref) await confirmSeats(session, confirmHref);
    const cart = await getCart(session);
    if (cart.isEmpty || !cart.checkoutAction) continue;

    const saleId = await patronbaseCheckout(session, cart.checkoutAction);
    if (!saleId) continue;

    await prisma.reserva.create({
      data: {
        usuarioId: programacion.usuarioId,
        bibliotecaId: programacion.bibliotecaId,
        plantaId: programacion.plantaId,
        turnoId: turno.id,
        asientoCodigo: codigo,
        fecha: fechaObjetivo,
        estado: "proxima",
        origen: "programacion",
        programacionId: programacion.id,
        patronbaseSaleId: saleId ?? undefined,
      },
    });

    invalidarReservas(programacion.usuarioId);
    return { exito: true, motivo: `Reservado ${codigo} en ${programacion.planta.nombre} (${turnoTipo})` };
  }

  return {
    exito: false,
    motivo: `Ninguno de los asientos indicados (${candidatos.join(", ")}) estaba disponible`,
    asientosComprobados: true,
  };
}

async function procesarTurno(programacion: ProgramacionConRelaciones, turnoTipo: TurnoTipo, fechaObjetivo: Date) {
  const fechaObjetivoStr = fechaObjetivo.toISOString().slice(0, 10);
  const campoExito = CAMPO_EXITO[turnoTipo];
  if (programacion[campoExito] === fechaObjetivoStr) return; // ya conseguida para esa fecha

  // Antes de su hora de apertura PatronBase todavía no muestra el hueco como
  // disponible: esperar en vez de gastar un intento (y un log) en balde. Para
  // fechaObjetivo = hoy esto nunca bloquea, porque su apertura fue ayer.
  if (new Date() < instanteApertura(fechaObjetivo, turnoTipo)) return;

  if (!debeIntentarAhora(`${programacion.id}:${turnoTipo}:${fechaObjetivoStr}`)) return;

  const resultado = await intentarTurno(programacion, turnoTipo, fechaObjetivo);

  if (!resultado.exito) {
    await logActivity({
      usuarioId: programacion.usuarioId,
      programacionId: programacion.id,
      tipoEvento: "reintento",
      mensaje: resultado.motivo,
    });

    // Aviso informativo de una sola vez (no hace falta esperar a que acabe el día): en
    // cuanto se comprueban de verdad los asientos configurados y ninguno está libre, se
    // avisa ya — el motor sigue reintentando por si se libera alguno más tarde, pero el
    // usuario no tiene que esperar al día siguiente para enterarse de que hoy no salió.
    const campoFallo = CAMPO_FALLO[turnoTipo];
    if (resultado.asientosComprobados && programacion[campoFallo] !== fechaObjetivoStr) {
      await logActivity({
        usuarioId: programacion.usuarioId,
        programacionId: programacion.id,
        tipoEvento: "reserva_fallida",
        mensaje: `No se pudo reservar el ${formatearFechaEs(fechaObjetivo)} (${turnoTipo}) en ${programacion.planta.nombre}: ${resultado.motivo}`,
      });
      await prisma.programacion.update({ where: { id: programacion.id }, data: { [campoFallo]: fechaObjetivoStr } });
    }
    return;
  }

  await logActivity({
    usuarioId: programacion.usuarioId,
    programacionId: programacion.id,
    tipoEvento: "reserva_exitosa",
    mensaje: resultado.motivo,
  });

  const nuevoContador = programacion.contadorReservasRealizadas + 1;
  const data: Prisma.ProgramacionUpdateInput = {
    [campoExito]: fechaObjetivoStr,
    contadorReservasRealizadas: nuevoContador,
  };
  if (programacion.tipo === "n_reservas" && programacion.valorTipoNumero && nuevoContador >= programacion.valorTipoNumero) {
    data.estado = "finalizada";
  }
  if (programacion.tipo === "hasta_fecha" && programacion.valorTipoFecha && new Date() >= programacion.valorTipoFecha) {
    data.estado = "finalizada";
  }
  // proximaEjecucion es solo informativo (se recalcula en cada lectura, ver
  // calcularProximaEjecucion); se guarda aquí con el estado y las fechas ya
  // actualizadas para que quien consulte la fila cruda en base de datos no vea un
  // valor obsoleto.
  data.proximaEjecucion = calcularProximaEjecucion({
    estado: (data.estado as string) ?? programacion.estado,
    diasSemana: programacion.diasSemana,
    turnos: programacion.turnos,
    ultimaFechaReservadaManana: turnoTipo === "manana" ? fechaObjetivoStr : programacion.ultimaFechaReservadaManana,
    ultimaFechaReservadaTarde: turnoTipo === "tarde" ? fechaObjetivoStr : programacion.ultimaFechaReservadaTarde,
  });
  await prisma.programacion.update({ where: { id: programacion.id }, data });
}

async function procesarProgramacion(programacion: ProgramacionConRelaciones) {
  const turnos = JSON.parse(programacion.turnos) as TurnoTipo[];
  const diasSemana = JSON.parse(programacion.diasSemana) as number[];

  // Se comprueban "hoy" y "mañana" como posibles fechas objetivo: PatronBase abre cada
  // hueco el día anterior, pero sigue reservable durante todo el día siguiente. Sin
  // "hoy", una programación recién activada (o que falló el día anterior) se saltaba
  // directamente al día siguiente aunque el hueco de hoy siguiera libre.
  const candidatas = [new Date(), addDays(new Date(), 1)];

  for (const fechaObjetivo of candidatas) {
    if (!diasSemana.includes(fechaObjetivo.getDay())) continue;
    for (const turnoTipo of turnos) {
      await procesarTurno(programacion, turnoTipo, fechaObjetivo);
    }
  }
}

export function startScheduleEngine() {
  cron.schedule("* * * * *", async () => {
    const programaciones = await prisma.programacion.findMany({
      where: { estado: "activa" },
      include: { biblioteca: true, planta: { include: { turnos: true } }, usuario: true },
    });

    for (const programacion of programaciones) {
      procesarProgramacion(programacion).catch((err) =>
        logActivity({
          usuarioId: programacion.usuarioId,
          programacionId: programacion.id,
          tipoEvento: "otro",
          mensaje: `Error inesperado del motor: ${(err as Error).message}`,
        }),
      );
    }
  });
}
