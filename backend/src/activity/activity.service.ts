import { prisma } from "../db";

type TipoEvento = "reserva_exitosa" | "reserva_fallida" | "reintento" | "puesto_retirado" | "otro";

export async function logActivity(params: {
  usuarioId: string;
  cuentaId?: string | null;
  programacionId?: string | null;
  tipoEvento: TipoEvento;
  mensaje: string;
}) {
  return prisma.actividadLog.create({
    data: {
      usuarioId: params.usuarioId,
      cuentaId: params.cuentaId ?? undefined,
      programacionId: params.programacionId ?? undefined,
      tipoEvento: params.tipoEvento,
      mensaje: params.mensaje,
    },
  });
}

export async function listActivity(params: {
  cuentaId: string;
  tipoEvento?: TipoEvento;
  programacionId?: string;
  desde?: Date;
  hasta?: Date;
}) {
  return prisma.actividadLog.findMany({
    where: {
      cuentaId: params.cuentaId,
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
