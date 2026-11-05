import { parseAsiento } from "../../api/seatLabel";
import { useCuentas } from "../../auth/CuentaContext";
import type { ReservaPatronBase } from "../../api/types";

const TURNO_ESTILO: Record<"manana" | "tarde", { label: string; classes: string }> = {
  manana: { label: "Mañana", classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  tarde: { label: "Tarde", classes: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
};

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

function ReservaCard({ grupo, mostrarCuenta }: { grupo: ReservaPatronBase[]; mostrarCuenta: boolean }) {
  const reserva = grupo[0];
  const turno = reserva.turnoTipo ? TURNO_ESTILO[reserva.turnoTipo] : null;
  const cuentas = [...new Set(grupo.map((r) => r.cuentaNombre).filter((n): n is string => !!n))];
  const asientos = asientosPorTipo(grupo);

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
        {mostrarCuenta && cuentas.length > 0 && (
          <p className="mb-1 text-xs font-medium text-brand-700 dark:text-brand-300">{cuentas.join(" · ")}</p>
        )}
        <p className="text-base font-semibold leading-tight text-slate-800 dark:text-slate-100">{reserva.bibliotecaNombre}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{reserva.plantaNombre}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium capitalize">
            {new Date(reserva.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {asientos.map(({ tipo, valores }) => (
            <div key={tipo ?? ""} className="contents">
              {tipo && (
                <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-700/60">
                  <span className="text-slate-400 dark:text-slate-500">Tipo</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{tipo}</span>
                </div>
              )}
              <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-700/60">
                <span className="text-slate-400 dark:text-slate-500">{valores.length > 1 ? "Asientos" : "Asiento"}</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{valores.join(" · ")}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {grupo.map((r) => (
            <a
              key={r.saleId + r.asiento}
              href={r.enlacePatronBase}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Ver en PatronBase{grupo.length > 1 ? ` (${r.cuentaNombre ?? parseAsiento(r.asiento)?.numero ?? r.asiento})` : ""} →
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReservationsList({ titulo, reservas, vacio }: { titulo: string; reservas: ReservaPatronBase[]; vacio: string }) {
  const { cuentaActiva, vistaTodas } = useCuentas();
  const mostrarCuenta = vistaTodas || (!!cuentaActiva && cuentaActiva.modoReservas !== "esta");
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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
          {agrupar(reservas).map((g) => (
            <ReservaCard key={g.map((r) => r.saleId + r.asiento).join("+")} grupo={g} mostrarCuenta={mostrarCuenta} />
          ))}
        </div>
      )}
    </div>
  );
}
