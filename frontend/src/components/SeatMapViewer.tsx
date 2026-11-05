import { useState } from "react";
import type { SeatInfo } from "../api/types";
import { formatearAsiento, parseAsiento } from "../api/seatLabel";

type Props = {
  seats: SeatInfo[];
  /** "multi": todos los asientos se pueden marcar (programaciones: el estado de un día concreto no importa). */
  mode: "single" | "double" | "multi";
  selected?: SeatInfo | null;
  selectedAlternate?: SeatInfo | null;
  pickingAlternate?: boolean;
  /** Solo en modo "multi": números de asiento ya marcados. */
  multiSelected?: string[];
  onSelect: (seat: SeatInfo) => void;
};

/** Número que se pinta en cada casilla (el de la etiqueta de PatronBase). */
export function numeroAsiento(seat: SeatInfo): string {
  return parseAsiento(seat.label)?.numero ?? seat.label.match(/(\d+)\s*$/)?.[1] ?? seat.seatId;
}

function agruparPorTipo(seats: SeatInfo[]): Array<{ tipo: string; seats: SeatInfo[] }> {
  const grupos = new Map<string, SeatInfo[]>();
  for (const seat of seats) {
    const tipo = parseAsiento(seat.label)?.tipo ?? "Otros";
    grupos.set(tipo, [...(grupos.get(tipo) ?? []), seat]);
  }
  return Array.from(grupos.entries()).map(([tipo, seats]) => ({ tipo, seats }));
}

export function SeatMapViewer({ seats, mode, selected = null, selectedAlternate, pickingAlternate, multiSelected = [], onSelect }: Props) {
  const [hovered, setHovered] = useState<SeatInfo | null>(null);
  const multi = mode === "multi";
  const libre = (seat: SeatInfo) => multi || seat.state === "available";

  function colorFor(seat: SeatInfo) {
    if (multi) {
      if (multiSelected.includes(numeroAsiento(seat))) return "bg-brand-500 cursor-pointer";
      return seat.state === "available"
        ? "bg-emerald-500 hover:bg-emerald-600 cursor-pointer"
        : "bg-slate-500 hover:bg-slate-600 cursor-pointer dark:bg-slate-600";
    }
    if (seat.seatId === selected?.seatId && seat.rowId === selected?.rowId) return "bg-brand-500";
    if (mode === "double" && seat.seatId === selectedAlternate?.seatId && seat.rowId === selectedAlternate?.rowId) {
      return "bg-brand-300";
    }
    if (seat.state !== "available") return "bg-slate-800 dark:bg-slate-950 cursor-not-allowed";
    return "bg-emerald-500 hover:bg-emerald-600 cursor-pointer";
  }

  const activo = hovered ?? selected;
  const grupos = agruparPorTipo(seats);

  return (
    <div>
      <div className="space-y-4">
        {grupos.map(({ tipo, seats: seatsDelGrupo }) => (
          <div key={tipo}>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{tipo}</h4>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1 rounded-xl bg-slate-100 p-3 dark:bg-slate-700">
              {seatsDelGrupo.map((seat) => (
                <button
                  key={`${seat.rowId}-${seat.seatId}`}
                  type="button"
                  disabled={!libre(seat)}
                  title={formatearAsiento(seat.label)}
                  aria-label={formatearAsiento(seat.label)}
                  onMouseEnter={() => setHovered(seat)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelect(seat)}
                  className={`flex h-9 w-full items-center justify-center rounded-md text-xs font-semibold leading-none text-white transition ${colorFor(seat)}`}
                >
                  {numeroAsiento(seat)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {multi ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Toca los asientos por orden de preferencia; vuelve a tocar uno marcado para quitarlo. En gris, los ocupados en el día de
          muestra (también se pueden elegir).
        </p>
      ) : (
        <div className="mt-3 flex min-h-[1.5rem] items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          {activo ? (
            <>
              <span className="font-medium">{formatearAsiento(activo.label)}</span>
              <span className="text-slate-400 dark:text-slate-500">·</span>
              <span>{activo.state === "available" ? "Libre" : "Ocupado"}</span>
            </>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">Toca un asiento verde para elegirlo</span>
          )}
        </div>
      )}
      {mode === "double" && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {pickingAlternate ? "Selecciona ahora la Opción 2 (alternativa)." : "Selecciona la Opción 1 (preferida)."}
        </p>
      )}
    </div>
  );
}
