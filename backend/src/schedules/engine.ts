import cron from "node-cron";
import { prisma } from "../db";
import { env } from "../env";
import { logActivity } from "../activity/activity.service";
import { getAuthenticatedSession } from "../patronbaseAccount/account.service";
import { coincideAsiento, confirmSeats, getCart, getPerformances, getSeatMap, holdSeat, liberarCesta, checkout as patronbaseCheckout } from "../patronbase/adapter";
import { addDays, fechaLocalISO, formatearFechaEs, labelMatchesDate, startOfDay } from "../libraries/dateEs";
import { withAccountLock } from "../patronbase/accountLock";
import { invalidarReservas, tieneReservaReal } from "../reservations/reservations.service";
import { instanteApertura, type TurnoTipo } from "./apertura";
import { diaTurnoPermitido } from "./rules";
import { agregarFecha, leerFechas } from "./fechasProgramacion";
import { calcularProximaEjecucion } from "./schedules.service";
import type { Prisma } from "@prisma/client";

type ProgramacionConRelaciones = Prisma.ProgramacionGetPayload<{
  include: { biblioteca: true; planta: { include: { turnos: true } }; usuario: true };
}>;

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
const VENTANA_REINTENTO_MINUTOS = 10;
const intentadoFueraDeVentana = new Set<string>();
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
    session = await getAuthenticatedSession(programacion.cuentaId!);
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

    let saleId: string | null = null;
    try {
      if (confirmHref) await confirmSeats(session, confirmHref);
      const cart = await getCart(session);
      if (!cart.isEmpty && cart.checkoutAction) saleId = await patronbaseCheckout(session, cart.checkoutAction);
    } catch (err) {
      await liberarCesta(session);
      throw err;
    }
    if (!saleId) {
      await liberarCesta(session);
      continue;
    }

    await prisma.reserva.create({
      data: {
        usuarioId: programacion.usuarioId,
        cuentaId: programacion.cuentaId,
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

    invalidarReservas(programacion.cuentaId!);
    return { exito: true, motivo: `Reservado ${codigo} en ${programacion.planta.nombre} (${turnoTipo})` };
  }

  return {
    exito: false,
    motivo: `Ninguno de los asientos indicados (${candidatos.join(", ")}) estaba disponible`,
    asientosComprobados: true,
  };
}

async function procesarTurno(programacion: ProgramacionConRelaciones, turnoTipo: TurnoTipo, fechaObjetivo: Date) {
  const fechaObjetivoStr = fechaLocalISO(fechaObjetivo);
  const campoExito = CAMPO_EXITO[turnoTipo];
  if (leerFechas(programacion[campoExito]).includes(fechaObjetivoStr)) return; // ya conseguida para esa fecha

  // Si ya hay una reserva de este usuario para ese día y turno (hecha a mano, o por el
  // motor sin que quedara anotada la fecha), no hay nada que intentar: reintentar solo
  // chocaría con su propio asiento y registraría un fallo que no es real.
  const turno = programacion.planta.turnos.find((t) => t.tipo === turnoTipo);
  if (turno) {
    const inicio = startOfDay(fechaObjetivo);
    const existente = await prisma.reserva.findFirst({
      where: {
        usuarioId: programacion.usuarioId,
        cuentaId: programacion.cuentaId,
        turnoId: turno.id,
        fecha: { gte: inicio, lt: addDays(inicio, 1) },
      },
    });
    if (existente) {
      const valor = agregarFecha(programacion[campoExito], fechaObjetivoStr);
      await prisma.programacion.update({ where: { id: programacion.id }, data: { [campoExito]: valor } });
      (programacion as Record<string, unknown>)[campoExito] = valor;
      return;
    }
  }

  // Antes de su hora de apertura PatronBase todavía no muestra el hueco como
  // disponible: esperar en vez de gastar un intento (y un log) en balde. Para
  // fechaObjetivo = hoy esto nunca bloquea, porque su apertura fue ayer.
  const apertura = instanteApertura(fechaObjetivo, turnoTipo);
  const ahora = Date.now();
  if (ahora < apertura.getTime()) return;

  // El hueco solo compite justo al abrirse: se reintenta cada SCHEDULE_RETRY_DELAY_MINUTES
  // durante VENTANA_REINTENTO_MINUTOS desde la apertura (por si PatronBase tarda unos
  // segundos en publicarlo o se libera algún asiento enseguida) y se deja de insistir.
  // Fuera de esa ventana (p. ej. programación creada con el hueco ya abierto, o reinicio
  // del servidor) solo se hace un intento por fecha, y ninguno si ya consta un fallo.
  const clave = `${programacion.id}:${turnoTipo}:${fechaObjetivoStr}`;
  const enVentana = ahora - apertura.getTime() <= VENTANA_REINTENTO_MINUTOS * 60 * 1000;
  if (!enVentana) {
    if (leerFechas(programacion[CAMPO_FALLO[turnoTipo]]).includes(fechaObjetivoStr)) return;
    if (intentadoFueraDeVentana.has(clave)) return;
    intentadoFueraDeVentana.add(clave);
  } else if (!debeIntentarAhora(clave)) {
    return;
  }

  // Las programaciones de una misma cuenta se turnan: así la segunda ve la reserva que acaba de
  // hacer la primera (solo se puede reservar un asiento por sesión) en vez de chocar con ella.
  return withAccountLock(programacion.cuentaId ?? programacion.usuarioId, () =>
    intentarYRegistrar(programacion, turnoTipo, fechaObjetivo, fechaObjetivoStr),
  );
}

async function intentarYRegistrar(
  programacion: ProgramacionConRelaciones,
  turnoTipo: TurnoTipo,
  fechaObjetivo: Date,
  fechaObjetivoStr: string,
) {
  const campoExito = CAMPO_EXITO[turnoTipo];
  // Si la cuenta ya tiene en PatronBase una reserva para esa sala, turno y día (hecha a
  // mano, desde otra programación o antes de crear esta), no hay nada que intentar: el
  // asiento aparecería ocupado por ella misma y se registraría un fallo que no es real.
  try {
    const yaReservada = await tieneReservaReal(programacion.cuentaId!, {
      bibliotecaNombre: programacion.biblioteca.nombre,
      plantaNombre: programacion.planta.nombre,
      turnoTipo,
      fechaISO: fechaObjetivoStr,
    });
    if (yaReservada) {
      const valor = agregarFecha(programacion[campoExito], fechaObjetivoStr);
      await prisma.programacion.update({ where: { id: programacion.id }, data: { [campoExito]: valor } });
      (programacion as Record<string, unknown>)[campoExito] = valor;
      await logActivity({
        usuarioId: programacion.usuarioId,
        cuentaId: programacion.cuentaId,
        programacionId: programacion.id,
        tipoEvento: "otro",
        mensaje: `Ya tenías una reserva para el ${formatearFechaEs(fechaObjetivo)} (${turnoTipo}) en ${programacion.planta.nombre}: no hace falta reservar`,
      });
      return;
    }
  } catch (err) {
    // Si no se puede leer el historial se intenta reservar igualmente, como antes.
    console.warn("[engine] no se pudo comprobar las reservas existentes:", (err as Error).message);
  }

  const resultado = await intentarTurno(programacion, turnoTipo, fechaObjetivo);

  if (!resultado.exito) {
    await logActivity({
      usuarioId: programacion.usuarioId,
        cuentaId: programacion.cuentaId,
      programacionId: programacion.id,
      tipoEvento: "reintento",
      mensaje: resultado.motivo,
    });

    // Aviso informativo de una sola vez (no hace falta esperar a que acabe el día): en
    // cuanto se comprueban de verdad los asientos configurados y ninguno está libre, se
    // avisa ya — el motor sigue reintentando por si se libera alguno más tarde, pero el
    // usuario no tiene que esperar al día siguiente para enterarse de que hoy no salió.
    const campoFallo = CAMPO_FALLO[turnoTipo];
    if (resultado.asientosComprobados && !leerFechas(programacion[campoFallo]).includes(fechaObjetivoStr)) {
      await logActivity({
        usuarioId: programacion.usuarioId,
        cuentaId: programacion.cuentaId,
        programacionId: programacion.id,
        tipoEvento: "reserva_fallida",
        fechaObjetivo: fechaObjetivoStr,
        turnoTipo,
        mensaje: `No se pudo reservar el ${formatearFechaEs(fechaObjetivo)} (${turnoTipo}) en ${programacion.planta.nombre}: ${resultado.motivo}`,
      });
      const nuevoValor = agregarFecha(programacion[campoFallo], fechaObjetivoStr);
      await prisma.programacion.update({ where: { id: programacion.id }, data: { [campoFallo]: nuevoValor } });
      // Se refleja en el objeto en memoria para que, si en este mismo tick también se
      // procesa la otra fecha candidata (hoy/mañana) del mismo turno, no se pise este
      // cambio con un valor desactualizado.
      (programacion as Record<string, unknown>)[campoFallo] = nuevoValor;
    }
    return;
  }

  await logActivity({
    usuarioId: programacion.usuarioId,
        cuentaId: programacion.cuentaId,
    programacionId: programacion.id,
    tipoEvento: "reserva_exitosa",
    mensaje: resultado.motivo,
  });

  const nuevoContador = programacion.contadorReservasRealizadas + 1;
  const nuevoValorExito = agregarFecha(programacion[campoExito], fechaObjetivoStr);
  const data: Prisma.ProgramacionUpdateInput = {
    [campoExito]: nuevoValorExito,
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
    ultimaFechaReservadaManana: turnoTipo === "manana" ? nuevoValorExito : programacion.ultimaFechaReservadaManana,
    ultimaFechaReservadaTarde: turnoTipo === "tarde" ? nuevoValorExito : programacion.ultimaFechaReservadaTarde,
  });
  await prisma.programacion.update({ where: { id: programacion.id }, data });
  (programacion as Record<string, unknown>)[campoExito] = nuevoValorExito;
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
        cuentaId: programacion.cuentaId,
          programacionId: programacion.id,
          tipoEvento: "otro",
          mensaje: `Error inesperado del motor: ${(err as Error).message}`,
        }),
      );
    }
  });
}
