import type { Programacion } from "../api/types";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const ESTADO_LABEL: Record<Programacion["estado"], string> = {
  activa: "Activa",
  pausada: "Pausada",
  finalizada: "Finalizada",
};

export function ScheduleCard({
  programacion,
  onTogglePause,
  onDelete,
}: {
  programacion: Programacion;
  onTogglePause: () => void;
  onDelete: () => void;
}) {
  const turnos = JSON.parse(programacion.turnos) as string[];
  const diasSemana = JSON.parse(programacion.diasSemana) as number[];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-slate-800 dark:text-slate-100">
            {programacion.biblioteca.nombre} · {programacion.planta.nombre}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {turnos.map((t) => (t === "manana" ? "Mañana" : "Tarde")).join(" y ")}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            programacion.estado === "activa"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : programacion.estado === "pausada"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
          }`}
        >
          {ESTADO_LABEL[programacion.estado]}
        </span>
      </div>

      <div className="mt-3 flex gap-1 text-xs">
        {DIAS.map((d, i) => (
          <span
            key={d}
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              diasSemana.includes(i)
                ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                : "text-slate-300 dark:text-slate-600"
            }`}
          >
            {d[0]}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Reservas realizadas: {programacion.contadorReservasRealizadas}
        {programacion.tipo === "n_reservas" && programacion.valorTipoNumero ? ` / ${programacion.valorTipoNumero}` : ""}
      </p>
      {programacion.proximaEjecucion && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Próxima ejecución: {new Date(programacion.proximaEjecucion).toLocaleString("es-ES")}
        </p>
      )}

      {programacion.estado !== "finalizada" && (
        <div className="mt-4 flex gap-2 text-xs">
          <button
            onClick={onTogglePause}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {programacion.estado === "activa" ? "Pausar" : "Reanudar"}
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg border border-red-200 px-3 py-1.5 font-medium text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
