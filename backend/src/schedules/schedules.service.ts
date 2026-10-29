import { prisma } from "../db";
import { addDays, fechaLocalISO } from "../libraries/dateEs";
import { instanteApertura } from "./apertura";
import { leerFechas } from "./fechasProgramacion";
import { diaTurnoPermitido } from "./rules";

type CrearProgramacionInput = {
  usuarioId: string;
  cuentaId: string;
  nombre?: string;
  bibliotecaId: string;
  plantaId: string;
  turnos: Array<"manana" | "tarde">;
  tipo: "n_reservas" | "hasta_fecha" | "indefinida";
  valorTipoNumero?: number;
  valorTipoFecha?: string;
  diasSemana: number[];
  asientosCodigos: string[]; // en orden de preferencia
};

type ProgramacionParaProximaEjecucion = {
  estado: string;
  diasSemana: string; // JSON
  turnos: string; // JSON
  ultimaFechaReservadaManana: string | null;
  ultimaFechaReservadaTarde: string | null;
  ultimaFechaFallidaManana?: string | null;
  ultimaFechaFallidaTarde?: string | null;
};

/**
 * Próximo instante en que el motor va a intentar reservar: la apertura del hueco (el día
 * anterior a las 7:00 en mañana, a las 14:00 en tarde) del primer día de diasSemana con
 * algún turno todavía pendiente. Un turno pendiente cuya apertura ya pasó y que ya
 * consta como fallido se da por perdido (el motor no insiste), así que se salta. Si la
 * apertura ya pasó pero aún se está intentando, se devuelve ese instante pasado.
 *
 * Se recalcula en cada lectura en vez de fiarse de un valor persistido, para no mostrar
 * una fecha obsoleta tras una pausa o un día sin sitio.
 */
export function calcularProximaEjecucion(p: ProgramacionParaProximaEjecucion): Date | null {
  if (p.estado !== "activa") return null;

  const diasSemana = JSON.parse(p.diasSemana) as number[];
  const turnos = JSON.parse(p.turnos) as Array<"manana" | "tarde">;
  if (diasSemana.length === 0 || turnos.length === 0) return null;

  const ahora = Date.now();
  for (let i = 0; i <= 8; i++) {
    const candidata = addDays(new Date(), i);
    if (!diasSemana.includes(candidata.getDay())) continue;

    const candidataStr = fechaLocalISO(candidata);
    let mejor: Date | null = null;
    for (const t of turnos) {
      const hecho = leerFechas(t === "manana" ? p.ultimaFechaReservadaManana : p.ultimaFechaReservadaTarde);
      if (hecho.includes(candidataStr)) continue;
      const apertura = instanteApertura(candidata, t);
      const fallido = leerFechas(t === "manana" ? p.ultimaFechaFallidaManana ?? null : p.ultimaFechaFallidaTarde ?? null);
      if (apertura.getTime() < ahora && fallido.includes(candidataStr)) continue;
      if (!mejor || apertura < mejor) mejor = apertura;
    }
    if (mejor) return mejor;
  }
  return null;
}

/**
 * Programaciones que ve el usuario según el ajuste de su cuenta activa: solo las de esa
 * cuenta ("esta"), las de todas sus cuentas ("todas") o las de las elegidas ("seleccionadas",
 * más siempre la activa). Cada una lleva el nombre de su cuenta.
 */
export async function listSchedules(usuarioId: string, cuentaActivaId: string, todas = false) {
  const cuentas = await prisma.cuentaPatronBase.findMany({ where: { usuarioId } });
  const activa = cuentas.find((c) => c.id === cuentaActivaId);
  if (!activa) return [];

  let ids: string[];
  if (todas || activa.modoProgramaciones === "todas") ids = cuentas.map((c) => c.id);
  else if (activa.modoProgramaciones === "seleccionadas") {
    const elegidas = JSON.parse(activa.programacionesDeCuentas) as string[];
    ids = cuentas.filter((c) => c.id === activa.id || elegidas.includes(c.id)).map((c) => c.id);
  } else ids = [activa.id];

  const items = await prisma.programacion.findMany({
    where: { cuentaId: { in: ids } },
    include: { biblioteca: true, planta: true },
    orderBy: { createdAt: "desc" },
  });
  const nombres = new Map(cuentas.map((c) => [c.id, c.alias || c.patronbaseEmail]));
  return items.map((p) => ({
    ...p,
    proximaEjecucion: calcularProximaEjecucion(p),
    cuentaNombre: p.cuentaId ? nombres.get(p.cuentaId) : undefined,
  }));
}

// Las operaciones sobre una programación concreta valen para cualquier cuenta del usuario,
// no solo la activa (la lista puede mostrar las de otras cuentas).
const delUsuario = (id: string, usuarioId: string) => ({ id, cuenta: { usuarioId } });

export async function createSchedule(input: CrearProgramacionInput) {
  const biblioteca = await prisma.biblioteca.findUnique({ where: { id: input.bibliotecaId } });
  const planta = await prisma.planta.findUnique({ where: { id: input.plantaId } });
  if (!biblioteca || !planta) throw new Error("Biblioteca o planta no encontrada");

  for (const dia of input.diasSemana) {
    for (const turnoTipo of input.turnos) {
      const check = diaTurnoPermitido({ biblioteca, planta, turnoTipo, diaSemana: dia });
      if (!check.permitido) {
        throw new Error(check.motivo ?? "Combinación de día/turno no permitida");
      }
    }
  }

  const diasSemanaJson = JSON.stringify(input.diasSemana);
  const turnosJson = JSON.stringify(input.turnos);
  return prisma.programacion.create({
    data: {
      usuarioId: input.usuarioId,
      cuentaId: input.cuentaId,
      nombre: input.nombre?.trim() || `${biblioteca.nombre} · ${planta.nombre}`,
      bibliotecaId: input.bibliotecaId,
      plantaId: input.plantaId,
      turnos: turnosJson,
      tipo: input.tipo,
      valorTipoNumero: input.valorTipoNumero,
      valorTipoFecha: input.valorTipoFecha ? new Date(input.valorTipoFecha) : undefined,
      diasSemana: diasSemanaJson,
      asientosCodigos: JSON.stringify(input.asientosCodigos.map((c) => c.trim()).filter(Boolean)),
      estado: "activa",
      proximaEjecucion: calcularProximaEjecucion({
        estado: "activa",
        diasSemana: diasSemanaJson,
        turnos: turnosJson,
        ultimaFechaReservadaManana: null,
        ultimaFechaReservadaTarde: null,
      }),
    },
  });
}

export async function setEstado(id: string, usuarioId: string, estado: "activa" | "pausada") {
  const actual = await prisma.programacion.findFirst({ where: delUsuario(id, usuarioId) });
  if (!actual) return { count: 0 };

  // Reanudar una programación finalizada arranca un ciclo nuevo con la misma
  // configuración: en "n_reservas" el contador vuelve a 0 (si no, el motor la daría por
  // terminada en la siguiente reserva). En "hasta_fecha" no hay forma de deducir una
  // nueva fecha límite, así que si la actual ya pasó hay que editarla primero.
  const reanudandoFinalizada = actual.estado === "finalizada" && estado === "activa";
  if (reanudandoFinalizada && actual.tipo === "hasta_fecha" && actual.valorTipoFecha && new Date() >= actual.valorTipoFecha) {
    throw new Error("La fecha límite de esta programación ya ha pasado: edítala para ponerle una nueva antes de reanudarla");
  }

  return prisma.programacion.updateMany({
    where: delUsuario(id, usuarioId),
    data: {
      estado,
      contadorReservasRealizadas: reanudandoFinalizada && actual.tipo === "n_reservas" ? 0 : undefined,
      // Pausada no tiene "próxima ejecución" (null explícito); al reactivar se recalcula.
      proximaEjecucion: calcularProximaEjecucion({ ...actual, estado }),
    },
  });
}

type ActualizarProgramacionInput = Partial<{
  nombre: string;
  bibliotecaId: string;
  plantaId: string;
  turnos: Array<"manana" | "tarde">;
  tipo: "n_reservas" | "hasta_fecha" | "indefinida";
  valorTipoNumero: number;
  valorTipoFecha: string;
  diasSemana: number[];
  asientosCodigos: string[];
}>;

export async function updateSchedule(id: string, usuarioId: string, input: ActualizarProgramacionInput) {
  const actual = await prisma.programacion.findFirst({ where: delUsuario(id, usuarioId) });
  if (!actual) throw new Error("Programación no encontrada");

  const bibliotecaId = input.bibliotecaId ?? actual.bibliotecaId;
  const plantaId = input.plantaId ?? actual.plantaId;
  const turnos = input.turnos ?? (JSON.parse(actual.turnos) as Array<"manana" | "tarde">);
  const diasSemana = input.diasSemana ?? (JSON.parse(actual.diasSemana) as number[]);
  const tipo = input.tipo ?? (actual.tipo as ActualizarProgramacionInput["tipo"]);

  const biblioteca = await prisma.biblioteca.findUnique({ where: { id: bibliotecaId } });
  const planta = await prisma.planta.findUnique({ where: { id: plantaId } });
  if (!biblioteca || !planta) throw new Error("Biblioteca o planta no encontrada");

  for (const dia of diasSemana) {
    for (const turnoTipo of turnos) {
      const check = diaTurnoPermitido({ biblioteca, planta, turnoTipo, diaSemana: dia });
      if (!check.permitido) {
        throw new Error(check.motivo ?? "Combinación de día/turno no permitida");
      }
    }
  }

  const diasSemanaJson = JSON.stringify(diasSemana);
  const turnosJson = JSON.stringify(turnos);
  return prisma.programacion.update({
    where: { id },
    data: {
      nombre: input.nombre !== undefined ? input.nombre.trim() || `${biblioteca.nombre} · ${planta.nombre}` : undefined,
      bibliotecaId,
      plantaId,
      turnos: turnosJson,
      tipo,
      valorTipoNumero: tipo === "n_reservas" ? (input.valorTipoNumero ?? actual.valorTipoNumero ?? undefined) : null,
      valorTipoFecha:
        tipo === "hasta_fecha" ? (input.valorTipoFecha ? new Date(input.valorTipoFecha) : actual.valorTipoFecha) : null,
      diasSemana: diasSemanaJson,
      asientosCodigos:
        input.asientosCodigos !== undefined
          ? JSON.stringify(input.asientosCodigos.map((c) => c.trim()).filter(Boolean))
          : undefined,
      // Cambiar los turnos/días puede volver "ya conseguida" una fecha ya no aplicable
      // (o al revés); se recalcula con el estado actual y las fechas ya reservadas.
      proximaEjecucion: calcularProximaEjecucion({
        estado: actual.estado,
        diasSemana: diasSemanaJson,
        turnos: turnosJson,
        ultimaFechaReservadaManana: actual.ultimaFechaReservadaManana,
        ultimaFechaReservadaTarde: actual.ultimaFechaReservadaTarde,
      }),
    },
    include: { biblioteca: true, planta: true },
  });
}

export async function getSchedule(id: string, usuarioId: string) {
  const p = await prisma.programacion.findFirst({ where: delUsuario(id, usuarioId), include: { biblioteca: true, planta: true } });
  return p ? { ...p, proximaEjecucion: calcularProximaEjecucion(p) } : null;
}

export async function deleteSchedule(id: string, usuarioId: string) {
  return prisma.programacion.deleteMany({ where: delUsuario(id, usuarioId) });
}
