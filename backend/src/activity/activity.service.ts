import { prisma } from "../db";

type TipoEvento = "reserva_exitosa" | "reserva_fallida" | "reintento" | "puesto_retirado" | "otro";

export async function logActivity(params: {
  usuarioId: string;
  programacionId?: string | null;
  tipoEvento: TipoEvento;
  mensaje: string;
}) {
  return prisma.actividadLog.create({
    data: {
      usuarioId: params.usuarioId,
      programacionId: params.programacionId ?? undefined,
      tipoEvento: params.tipoEvento,
      mensaje: params.mensaje,
    },
  });
}

export async function listActivity(params: {
  usuarioId: string;
  tipoEvento?: TipoEvento;
  programacionId?: string;
  desde?: Date;
  hasta?: Date;
}) {
  return prisma.actividadLog.findMany({
    where: {
      usuarioId: params.usuarioId,
      tipoEvento: params.tipoEvento,
      programacionId: params.programacionId,
      fecha: {
        gte: params.desde,
        lte: params.hasta,
      },
    },
    orderBy: { fecha: "desc" },
    take: 200,
  });
}
