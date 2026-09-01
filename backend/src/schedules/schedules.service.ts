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
  asientoPreferidoCodigo: string;
  asientoAlternativoCodigo?: string;
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
      asientoPreferidoCodigo: input.asientoPreferidoCodigo,
      asientoAlternativoCodigo: input.asientoAlternativoCodigo,
      estado: "activa",
      proximaEjecucion: proximaFecha(input.diasSemana) ?? undefined,
    },
  });
}

export async function setEstado(id: string, usuarioId: string, estado: "activa" | "pausada") {
  return prisma.programacion.updateMany({ where: { id, usuarioId }, data: { estado } });
}

export async function renombrarSchedule(id: string, usuarioId: string, nombre: string) {
  return prisma.programacion.updateMany({ where: { id, usuarioId }, data: { nombre: nombre.trim() } });
}

export async function deleteSchedule(id: string, usuarioId: string) {
  return prisma.programacion.deleteMany({ where: { id, usuarioId } });
}
