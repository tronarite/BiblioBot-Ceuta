import { useEffect, useState } from "react";
import { api } from "../api/client";
import { guardarLocal, leerLocal } from "../api/localCache";
import type { ActividadLog } from "../api/types";
import { Dropdown } from "./Dropdown";

const CLAVE_DESCARTADOS = "dash:reservasFallidas:descartadas";

/**
 * Aviso meramente informativo de reservas programadas que no se pudieron conseguir
 * (el motor ya se rindió para ese día concreto, ver "reserva_fallida" en
 * backend/src/schedules/engine.ts). Cada aviso se puede descartar con la X; el
 * descarte es solo local (localStorage) — no cambia nada en el servidor, así que si se
 * borra el caché del navegador vuelve a aparecer, pero no reaparece solo con recargar.
 */
export function FailedReservationsNotice() {
  const [fallos, setFallos] = useState<ActividadLog[]>([]);
  const [descartados, setDescartados] = useState<string[]>(() => leerLocal<string[]>(CLAVE_DESCARTADOS) ?? []);

  useEffect(() => {
    api
      .get<ActividadLog[]>("/account/activity?tipo=reserva_fallida")
      .then(setFallos)
      .catch(() => {});
  }, []);

  function descartar(id: string) {
    setDescartados((prev) => {
      const siguiente = [...prev, id];
      guardarLocal(CLAVE_DESCARTADOS, siguiente);
      return siguiente;
    });
  }

  const visibles = fallos.filter((f) => !descartados.includes(f.id));
  if (visibles.length === 0) return null;

  return (
    <Dropdown
      label={`Reservas no realizadas (${visibles.length}) ▾`}
      buttonClassName="whitespace-nowrap rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40"
      panelClassName="w-80 max-w-[90vw] space-y-2 border-red-200 text-red-900 dark:border-red-900/60 dark:text-red-200"
    >
      {visibles.map((f) => (
        <div
          key={f.id}
          className="flex items-start justify-between gap-2 rounded-lg bg-red-50/60 px-2 py-1.5 dark:bg-red-900/20"
        >
          <p className="text-sm">{f.mensaje}</p>
          <button
            type="button"
            onClick={() => descartar(f.id)}
            aria-label="Descartar aviso"
            className="shrink-0 rounded p-0.5 leading-none text-red-400 hover:bg-red-100 hover:text-red-700 dark:text-red-500 dark:hover:bg-red-900/40"
          >
            ✕
          </button>
        </div>
      ))}
    </Dropdown>
  );
}
