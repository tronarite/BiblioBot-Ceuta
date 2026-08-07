import cron from "node-cron";
import { prisma } from "../db";
import { env } from "../env";
import { logActivity } from "../activity/activity.service";
import { getAuthenticatedSession } from "../patronbaseAccount/account.service";
import { confirmSeats, getCart, getPerformances, getSeatMap, holdSeat, checkout as patronbaseCheckout } from "../patronbase/adapter";
import { addDays, labelMatchesDate } from "../libraries/dateEs";
import { diaTurnoPermitido } from "./rules";
import type { Prisma } from "@prisma/client";

type ProgramacionConRelaciones = Prisma.ProgramacionGetPayload<{
  include: { biblioteca: true; planta: { include: { turnos: true } }; usuario: true };
}>;

function proximaFechaDesde(diasSemana: number[], desde: Date): Date | null {
  for (let i = 1; i <= 8; i++) {
    const candidata = addDays(desde, i);
    if (diasSemana.includes(candidata.getDay())) {
      candidata.setHours(7, 0, 0, 0);
      return candidata;
    }
  }
  return null;
}

async function intentarTurno(
  programacion: ProgramacionConRelaciones,
  turnoTipo: "manana" | "tarde",
  fechaObjetivo: Date,
): Promise<{ exito: boolean; motivo: string }> {
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

  const candidatos = [programacion.asientoPreferidoCodigo, programacion.asientoAlternativoCodigo].filter(
    (c): c is string => Boolean(c),
  );

  for (const codigo of candidatos) {
    const asiento = seats.find((s) => s.label === codigo && s.state === "available");
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

    return { exito: true, motivo: `Reservado ${codigo} en ${programacion.planta.nombre} (${turnoTipo})` };
  }

  return { exito: false, motivo: "Ni el asiento preferido ni el alternativo estaban disponibles" };
}

async function procesarProgramacion(programacion: ProgramacionConRelaciones, esReintento: boolean) {
  const turnos = JSON.parse(programacion.turnos) as Array<"manana" | "tarde">;
  const diasSemana = JSON.parse(programacion.diasSemana) as number[];
  const fechaObjetivo = addDays(new Date(), 1);

  if (!diasSemana.includes(fechaObjetivo.getDay())) return;

  let algunExito = false;
  for (const turnoTipo of turnos) {
    const resultado = await intentarTurno(programacion, turnoTipo, fechaObjetivo);
    if (resultado.exito) {
      algunExito = true;
      await logActivity({
        usuarioId: programacion.usuarioId,
        programacionId: programacion.id,
        tipoEvento: "reserva_exitosa",
        mensaje: resultado.motivo,
      });
    } else {
      await logActivity({
        usuarioId: programacion.usuarioId,
        programacionId: programacion.id,
        tipoEvento: esReintento ? "reserva_fallida" : "reintento",
        mensaje: resultado.motivo,
      });
    }
  }

  if (!algunExito && !esReintento) {
    setTimeout(
      () => {
        procesarProgramacion(programacion, true).catch((err) =>
          logActivity({
            usuarioId: programacion.usuarioId,
            programacionId: programacion.id,
            tipoEvento: "otro",
            mensaje: `Error inesperado en el reintento: ${(err as Error).message}`,
          }),
        );
      },
      env.scheduleRetryDelayMinutes * 60 * 1000,
    );
    return;
  }

  if (algunExito) {
    const nuevoContador = programacion.contadorReservasRealizadas + 1;
    const data: Prisma.ProgramacionUpdateInput = {
      contadorReservasRealizadas: nuevoContador,
      proximaEjecucion: proximaFechaDesde(diasSemana, new Date()) ?? undefined,
    };
    if (programacion.tipo === "n_reservas" && programacion.valorTipoNumero && nuevoContador >= programacion.valorTipoNumero) {
      data.estado = "finalizada";
    }
    if (programacion.tipo === "hasta_fecha" && programacion.valorTipoFecha && new Date() >= programacion.valorTipoFecha) {
      data.estado = "finalizada";
    }
    await prisma.programacion.update({ where: { id: programacion.id }, data });
  }
}

export function startScheduleEngine() {
  cron.schedule("* * * * *", async () => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);
    if (hoy.getHours() < 7) return;

    const programaciones = await prisma.programacion.findMany({
      where: {
        estado: "activa",
        OR: [{ ultimoIntentoFecha: null }, { ultimoIntentoFecha: { not: hoyStr } }],
      },
      include: { biblioteca: true, planta: { include: { turnos: true } }, usuario: true },
    });

    for (const programacion of programaciones) {
      await prisma.programacion.update({ where: { id: programacion.id }, data: { ultimoIntentoFecha: hoyStr } });
      procesarProgramacion(programacion, false).catch((err) =>
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
