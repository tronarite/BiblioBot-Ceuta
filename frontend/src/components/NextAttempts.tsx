import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useCuentas } from "../auth/CuentaContext";
import type { Programacion } from "../api/types";

function formatear(iso: string): string {
  const fecha = new Date(iso);
  const dia = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const hora = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `${dia}, ${hora}`;
}

/** Cuándo intentará el bot reservar cada programación activa (la hora a la que abre el hueco). */
export function NextAttempts() {
  const { cuentaActiva, vistaTodas } = useCuentas();
  const mostrarCuenta = vistaTodas || (!!cuentaActiva && cuentaActiva.modoProgramaciones !== "esta");
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);

  useEffect(() => {
    api.get<Programacion[]>("/schedules").then(setProgramaciones).catch(() => {});
  }, []);

  const activas = programaciones
    .filter((p) => p.estado === "activa" && p.proximaEjecucion)
    .sort((a, b) => a.proximaEjecucion!.localeCompare(b.proximaEjecucion!));
  if (activas.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Próximos intentos automáticos
      </h2>
      <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
        {activas.map((p) => (
          <li key={p.id}>
            <Link to="/programaciones" className="hover:underline">
              {p.nombre ?? `${p.biblioteca.nombre} · ${p.planta.nombre}`}
            </Link>
            <span className="text-slate-500 dark:text-slate-400"> — {formatear(p.proximaEjecucion!)}</span>
            {mostrarCuenta && p.cuentaNombre && (
              <span className="text-xs text-slate-400 dark:text-slate-500"> · {p.cuentaNombre}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
