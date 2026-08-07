import type { Reserva } from "../../api/types";

function ReservaCard({ reserva }: { reserva: Reserva }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <p className="font-medium text-slate-800">{reserva.biblioteca.nombre}</p>
      <p className="text-slate-500">
        {reserva.planta.nombre} · {reserva.turno.tipo === "manana" ? "Mañana" : "Tarde"}
      </p>
      <p className="mt-1 text-slate-500">{new Date(reserva.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</p>
      <p className="mt-1 text-xs text-slate-400">Asiento: {reserva.asientoCodigo}</p>
    </div>
  );
}

export function ReservationsList({ titulo, reservas, vacio }: { titulo: string; reservas: Reserva[]; vacio: string }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{titulo}</h2>
      {reservas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-400">{vacio}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {reservas.map((r) => (
            <ReservaCard key={r.id} reserva={r} />
          ))}
        </div>
      )}
    </div>
  );
}
