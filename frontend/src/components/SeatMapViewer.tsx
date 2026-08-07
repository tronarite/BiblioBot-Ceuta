import { useState } from "react";
import type { SeatInfo } from "../api/types";

type Props = {
  seats: SeatInfo[];
  mode: "single" | "double";
  selected: SeatInfo | null;
  selectedAlternate?: SeatInfo | null;
  pickingAlternate?: boolean;
  onSelect: (seat: SeatInfo) => void;
};

export function SeatMapViewer({ seats, mode, selected, selectedAlternate, pickingAlternate, onSelect }: Props) {
  const [hovered, setHovered] = useState<SeatInfo | null>(null);

  function colorFor(seat: SeatInfo) {
    if (seat.seatId === selected?.seatId && seat.rowId === selected?.rowId) return "bg-brand-500";
    if (mode === "double" && seat.seatId === selectedAlternate?.seatId && seat.rowId === selectedAlternate?.rowId) {
      return "bg-brand-300";
    }
    if (seat.state !== "available") return "bg-slate-800 cursor-not-allowed";
    return "bg-emerald-500 hover:bg-emerald-600 cursor-pointer";
  }

  const activo = hovered ?? selected;

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(1.5rem,1fr))] gap-1 rounded-xl bg-slate-100 p-4">
        {seats.map((seat) => (
          <button
            key={`${seat.rowId}-${seat.seatId}`}
            type="button"
            disabled={seat.state !== "available"}
            title={seat.label}
            onMouseEnter={() => setHovered(seat)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect(seat)}
            className={`h-6 w-6 rounded-sm transition ${colorFor(seat)}`}
          />
        ))}
      </div>
      <div className="mt-3 flex min-h-[1.5rem] items-center gap-2 text-sm text-slate-600">
        {activo ? (
          <>
            <span className="font-medium">{activo.label}</span>
            <span className="text-slate-400">·</span>
            <span>{activo.state === "available" ? "Libre" : "Ocupado"}</span>
          </>
        ) : (
          <span className="text-slate-400">Pasa el ratón sobre un asiento para ver su información</span>
        )}
      </div>
      {mode === "double" && (
        <p className="mt-2 text-xs text-slate-500">
          {pickingAlternate ? "Selecciona ahora la Opción 2 (alternativa)." : "Selecciona la Opción 1 (preferida)."}
        </p>
      )}
    </div>
  );
}
