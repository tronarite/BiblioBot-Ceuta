import { useState } from "react";
import { parseAsiento } from "../../api/seatLabel";
import { useCuentas } from "../../auth/CuentaContext";
import type { ReservaPatronBase } from "../../api/types";

const TURNO_ESTILO: Record<"manana" | "tarde", { label: string; classes: string }> = {
  manana: { label: "Mañana", classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  tarde: { label: "Tarde", classes: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
};

const CHIP = "inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-700/60";

/**
 * Reservas del mismo turno, día y planta (p. ej. de varias cuentas) se muestran en una sola
 * tarjeta: lo único que cambia entre ellas son los asientos, que se listan juntos.
 */
function agrupar(reservas: ReservaPatronBase[]): ReservaPatronBase[][] {
  const grupos = new Map<string, ReservaPatronBase[]>();
  for (const r of reservas) {
    const clave = [r.bibliotecaNombre, r.plantaNombre, r.fecha, r.horaSesion, r.turnoTipo ?? ""].join("|");
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(r);
    else grupos.set(clave, [r]);
  }
  return [...grupos.values()];
}

/** Asientos del grupo agrupados por tipo de puesto: [tipo | null, números/etiquetas]. */
function asientosPorTipo(grupo: ReservaPatronBase[]): { tipo: string | null; valores: string[] }[] {
  const porTipo = new Map<string, string[]>();
  for (const r of grupo) {
    const p = r.asiento ? parseAsiento(r.asiento) : null;
    const tipo = p ? p.tipo : "";
    const valor = p ? p.numero : r.asiento || "—";
    const lista = porTipo.get(tipo) ?? [];
    if (!lista.includes(valor)) lista.push(valor);
    porTipo.set(tipo, lista);
  }
  return [...porTipo.entries()].map(([tipo, valores]) => ({
    tipo: tipo || null,
    valores: valores.sort((a, b) => a.localeCompare(b, "es", { numeric: true })),
  }));
}

const numeroDe = (r: ReservaPatronBase) => (r.asiento ? (parseAsiento(r.asiento)?.numero ?? r.asiento) : "—");

function ReservaCard({ grupo, mostrarCuenta }: { grupo: ReservaPatronBase[]; mostrarCuenta: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const reserva = grupo[0];
  const turno = reserva.turnoTipo ? TURNO_ESTILO[reserva.turnoTipo] : null;
  const cuentas = [...new Set(grupo.map((r) => r.cuentaNombre).filter((n): n is string => !!n))];
  const asientos = asientosPorTipo(grupo);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      {/* Toda la tarjeta es el botón: al pulsarla se despliegan los enlaces a PatronBase. */}
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="flex w-full items-stretch text-left hover:bg-slate-50 dark:hover:bg-slate-700/40"
      >
        <span
          className={`flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 text-xs font-semibold uppercase tracking-wide ${
            turno ? turno.classes : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
          }`}
        >
          {turno ? turno.label : "—"}
        </span>

        <span className="block flex-1 p-4">
          {mostrarCuenta && cuentas.length > 0 && (
            <span className="mb-1 block text-xs font-medium text-brand-700 dark:text-brand-300">{cuentas.join(" · ")}</span>
          )}
          <span className="block text-base font-semibold leading-tight text-slate-800 dark:text-slate-100">
            {reserva.bibliotecaNombre}
          </span>
          <span className="block text-sm text-slate-500 dark:text-slate-400">{reserva.plantaNombre}</span>

          <span className="mt-2 block text-sm font-medium capitalize text-slate-600 dark:text-slate-300">
            {new Date(reserva.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </span>

          <span className="mt-3 flex flex-wrap gap-2">
            {asientos.map(({ tipo, valores }) => (
              <span key={tipo ?? ""} className="contents">
                {tipo && (
                  <span className={CHIP}>
                    <span className="text-slate-400 dark:text-slate-500">Tipo</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{tipo}</span>
                  </span>
                )}
                <span className={CHIP}>
                  <span className="text-slate-400 dark:text-slate-500">{valores.length > 1 ? "Asientos" : "Asiento"}</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{valores.join(" · ")}</span>
                </span>
              </span>
            ))}
          </span>
        </span>
      </button>

      {abierta && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          {grupo.map((r) => (
            <a
              key={r.saleId + r.asiento}
              href={r.enlacePatronBase}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Ver en PatronBase{grupo.length > 1 ? ` (${r.cuentaNombre ?? numeroDe(r)})` : ""} →
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReservationsList({ titulo, reservas, vacio }: { titulo: string; reservas: ReservaPatronBase[]; vacio: string }) {
  const { vistaTodas: mostrarCuenta } = useCuentas();
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</h2>
      {reservas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
          {vacio}
        </p>
      ) : (
        // auto-fit en vez de un breakpoint fijo: se adapta al ancho real del contenedor
        // (a pantalla completa o compartiendo espacio con "Ocupación de las bibliotecas").
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-3">
          {agrupar(reservas).map((g) => (
            <ReservaCard key={g.map((r) => r.saleId + r.asiento).join("+")} grupo={g} mostrarCuenta={mostrarCuenta} />
          ))}
        </div>
      )}
    </div>
  );
}
