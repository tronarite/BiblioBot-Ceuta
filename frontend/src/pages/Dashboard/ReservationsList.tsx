import type { ReservaPatronBase } from "../../api/types";

function ReservaCard({ reserva }: { reserva: ReservaPatronBase }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <p className="font-medium text-slate-800">{reserva.bibliotecaNombre}</p>
      <p className="text-slate-500">
        {reserva.plantaNombre}
        {reserva.turnoTipo ? ` · ${reserva.turnoTipo === "manana" ? "Mañana" : "Tarde"}` : ""}
      </p>
      <p className="mt-1 text-slate-500">
        {new Date(reserva.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        {reserva.horaSesion ? ` · ${reserva.horaSesion}` : ""}
      </p>
      <p className="mt-1 text-xs text-slate-400">Asiento: {reserva.asiento || "—"}</p>
    </div>
  );
}

export function ReservationsList({ titulo, reservas, vacio }: { titulo: string; reservas: ReservaPatronBase[]; vacio: string }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{titulo}</h2>
      {reservas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-400">{vacio}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {reservas.map((r) => (
            <ReservaCard key={r.saleId + r.fecha} reserva={r} />
          ))}
        </div>
      )}
    </div>
  );
}
