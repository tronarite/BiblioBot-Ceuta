import { prisma } from "../db";
import { addDays } from "../libraries/dateEs";
import { leerFechas } from "./fechasProgramacion";
import { diaTurnoPermitido } from "./rules";

type CrearProgramacionInput = {
  usuarioId: string;
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
};

/**
 * Próxima fecha (a partir de hoy) en la que la programación todavía tiene algo
 * pendiente: el primer día de diasSemana para el que al menos uno de los turnos
 * solicitados no tiene ya una reserva conseguida (ultimaFechaReservada{Manana,Tarde}).
 * Incluye "hoy" porque el motor (engine.ts) también puede reservar para hoy: el hueco
 * de un día abre el día anterior, pero sigue reservable durante todo ese día.
 *
 * Se recalcula en cada lectura en vez de fiarse de un valor persistido: el motor solo
 * tocaba antes ese campo tras una reserva con éxito, así que en cuanto la programación
 * se pausaba o pasaba un día sin conseguir sitio, se quedaba mostrando una fecha pasada
 * indefinidamente.
 */
export function calcularProximaEjecucion(p: ProgramacionParaProximaEjecucion): Date | null {
  if (p.estado !== "activa") return null;

  const diasSemana = JSON.parse(p.diasSemana) as number[];
  const turnos = JSON.parse(p.turnos) as Array<"manana" | "tarde">;
  if (diasSemana.length === 0 || turnos.length === 0) return null;

  for (let i = 0; i <= 8; i++) {
    const candidata = addDays(new Date(), i);
    if (!diasSemana.includes(candidata.getDay())) continue;

    const candidataStr = candidata.toISOString().slice(0, 10);
    const pendiente = turnos.some((t) =>
      t === "manana"
        ? !leerFechas(p.ultimaFechaReservadaManana).includes(candidataStr)
        : !leerFechas(p.ultimaFechaReservadaTarde).includes(candidataStr),
    );
    if (pendiente) {
      candidata.setHours(7, 0, 0, 0);
      return candidata;
    }
  }
  return null;
}

export async function listSchedules(usuarioId: string) {
  const items = await prisma.programacion.findMany({
    where: { usuarioId },
    include: { biblioteca: true, planta: true },
    orderBy: { createdAt: "desc" },
  });
  return items.map((p) => ({ ...p, proximaEjecucion: calcularProximaEjecucion(p) }));
}

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
  const actual = await prisma.programacion.findFirst({ where: { id, usuarioId } });
  if (!actual) return { count: 0 };

  return prisma.programacion.updateMany({
    where: { id, usuarioId },
    data: {
      estado,
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
  const actual = await prisma.programacion.findFirst({ where: { id, usuarioId } });
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
  const p = await prisma.programacion.findFirst({ where: { id, usuarioId }, include: { biblioteca: true, planta: true } });
  return p ? { ...p, proximaEjecucion: calcularProximaEjecucion(p) } : null;
}

export async function deleteSchedule(id: string, usuarioId: string) {
  return prisma.programacion.deleteMany({ where: { id, usuarioId } });
}
