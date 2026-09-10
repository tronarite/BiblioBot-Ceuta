import { prisma } from "../db";
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

function proximaFecha(diasSemana: number[]): Date | null {
  if (diasSemana.length === 0) return null;
  const hoy = new Date();
  for (let i = 0; i < 8; i++) {
    const candidata = new Date(hoy);
    candidata.setDate(hoy.getDate() + i);
    if (diasSemana.includes(candidata.getDay())) {
      candidata.setHours(7, 0, 0, 0);
      return candidata;
    }
  }
  return null;
}

export async function listSchedules(usuarioId: string) {
  return prisma.programacion.findMany({
    where: { usuarioId },
    include: { biblioteca: true, planta: true },
    orderBy: { createdAt: "desc" },
  });
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

  return prisma.programacion.create({
    data: {
      usuarioId: input.usuarioId,
      nombre: input.nombre?.trim() || `${biblioteca.nombre} · ${planta.nombre}`,
      bibliotecaId: input.bibliotecaId,
      plantaId: input.plantaId,
      turnos: JSON.stringify(input.turnos),
      tipo: input.tipo,
      valorTipoNumero: input.valorTipoNumero,
      valorTipoFecha: input.valorTipoFecha ? new Date(input.valorTipoFecha) : undefined,
      diasSemana: JSON.stringify(input.diasSemana),
      asientosCodigos: JSON.stringify(input.asientosCodigos.map((c) => c.trim()).filter(Boolean)),
      estado: "activa",
      proximaEjecucion: proximaFecha(input.diasSemana) ?? undefined,
    },
  });
}

export async function setEstado(id: string, usuarioId: string, estado: "activa" | "pausada") {
  return prisma.programacion.updateMany({ where: { id, usuarioId }, data: { estado } });
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

  return prisma.programacion.update({
    where: { id },
    data: {
      nombre: input.nombre !== undefined ? input.nombre.trim() || `${biblioteca.nombre} · ${planta.nombre}` : undefined,
      bibliotecaId,
      plantaId,
      turnos: JSON.stringify(turnos),
      tipo,
      valorTipoNumero: tipo === "n_reservas" ? (input.valorTipoNumero ?? actual.valorTipoNumero ?? undefined) : null,
      valorTipoFecha:
        tipo === "hasta_fecha" ? (input.valorTipoFecha ? new Date(input.valorTipoFecha) : actual.valorTipoFecha) : null,
      diasSemana: JSON.stringify(diasSemana),
      asientosCodigos:
        input.asientosCodigos !== undefined
          ? JSON.stringify(input.asientosCodigos.map((c) => c.trim()).filter(Boolean))
          : undefined,
      proximaEjecucion: proximaFecha(diasSemana) ?? undefined,
    },
    include: { biblioteca: true, planta: true },
  });
}

export async function getSchedule(id: string, usuarioId: string) {
  return prisma.programacion.findFirst({ where: { id, usuarioId }, include: { biblioteca: true, planta: true } });
}

export async function deleteSchedule(id: string, usuarioId: string) {
  return prisma.programacion.deleteMany({ where: { id, usuarioId } });
}
