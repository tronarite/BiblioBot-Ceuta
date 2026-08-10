import { parseAsiento } from "../../api/seatLabel";
import type { ReservaPatronBase } from "../../api/types";

const TURNO_ESTILO: Record<"manana" | "tarde", { label: string; classes: string }> = {
  manana: { label: "Mañana", classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  tarde: { label: "Tarde", classes: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
};

function ReservaCard({ reserva }: { reserva: ReservaPatronBase }) {
  const turno = reserva.turnoTipo ? TURNO_ESTILO[reserva.turnoTipo] : null;
  const asiento = reserva.asiento ? parseAsiento(reserva.asiento) : null;

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div
        className={`flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 text-xs font-semibold uppercase tracking-wide ${
          turno ? turno.classes : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
        }`}
      >
        <span>{turno ? turno.label : "—"}</span>
      </div>

      <div className="flex-1 p-4">
        <p className="text-base font-semibold leading-tight text-slate-800 dark:text-slate-100">{reserva.bibliotecaNombre}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{reserva.plantaNombre}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium capitalize">
            {new Date(reserva.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {asiento ? (
            <>
              <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-700/60">
                <span className="text-slate-400 dark:text-slate-500">Tipo</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{asiento.tipo}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-700/60">
                <span className="text-slate-400 dark:text-slate-500">Asiento</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{asiento.numero}</span>
              </div>
            </>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-700/60">
              <span className="text-slate-400 dark:text-slate-500">Asiento</span>
              <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{reserva.asiento || "—"}</span>
            </div>
          )}
        </div>

        <a
          href={reserva.enlacePatronBase}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Ver en PatronBase →
        </a>
      </div>
    </div>
  );
}

export function ReservationsList({ titulo, reservas, vacio }: { titulo: string; reservas: ReservaPatronBase[]; vacio: string }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</h2>
      {reservas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
          {vacio}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {reservas.map((r) => (
            <ReservaCard key={r.saleId + r.fecha + r.asiento} reserva={r} />
          ))}
        </div>
      )}
    </div>
  );
}
