import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { ActividadLog } from "../../api/types";

const ESTILOS: Record<string, string> = {
  reserva_exitosa: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  reserva_fallida: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  reintento: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  puesto_retirado: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  otro: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export function ActivityLog() {
  const [items, setItems] = useState<ActividadLog[]>([]);

  useEffect(() => {
    api.get<ActividadLog[]>("/account/activity").then(setItems);
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Actividad</h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Todavía no hay actividad registrada.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 text-sm">
              <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${ESTILOS[item.tipoEvento] ?? ESTILOS.otro}`}>
                {item.tipoEvento.replace("_", " ")}
              </span>
              <div>
                <p className="text-slate-700 dark:text-slate-200">{item.mensaje}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(item.fecha).toLocaleString("es-ES")}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
