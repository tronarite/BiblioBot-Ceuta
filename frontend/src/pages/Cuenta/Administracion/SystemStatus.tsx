import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import type { AdminActividad, AdminProgramacion, EstadoSistema } from "../../../api/types";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

const EVENTO_ESTILO: Record<string, string> = {
  reserva_exitosa: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  reserva_fallida: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  reintento: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

function nombreUsuario(u: { nombre: string; email: string | null; username: string | null }): string {
  return `${u.nombre} · ${u.email ?? u.username ?? ""}`;
}

export function SystemStatusAdmin() {
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [programaciones, setProgramaciones] = useState<AdminProgramacion[]>([]);
  const [actividad, setActividad] = useState<AdminActividad[]>([]);
  const [comprobando, setComprobando] = useState(false);

  function cargar() {
    api.get<EstadoSistema>("/admin/estado-sistema").then(setEstado);
    api.get<AdminProgramacion[]>("/admin/programaciones").then(setProgramaciones);
    api.get<AdminActividad[]>("/admin/actividad").then(setActividad);
  }

  useEffect(cargar, []);

  async function comprobarScraper() {
    setComprobando(true);
    try {
      await api.post("/admin/estado-sistema/comprobar-scraper", {});
      cargar();
    } finally {
      setComprobando(false);
    }
  }

  const scraper = estado?.scraper;

  return (
    <div className="space-y-6">
      {/* Estado del scraper */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium text-slate-800 dark:text-slate-100">Scraping de PatronBase</h2>
          <button
            onClick={comprobarScraper}
            disabled={comprobando}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {comprobando ? "Comprobando…" : "Comprobar ahora"}
          </button>
        </div>
        {scraper ? (
          <>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                scraper.ok
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              }`}
            >
              {scraper.ok ? "Funcionando" : "Con problemas"}
            </span>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{scraper.detalle}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Última comprobación: {new Date(scraper.comprobadoEn).toLocaleString("es-ES")}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">Todavía sin comprobar.</p>
        )}
      </div>

      {/* Resumen */}
      {estado && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Programaciones activas", estado.programacionesActivas],
            ["Cuentas PatronBase OK", estado.cuentasPatronBase.vinculada],
            ["Cuentas en error", estado.cuentasPatronBase.error],
            ["Sin vincular", estado.cuentasPatronBase.no_vinculada],
          ].map(([label, valor]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
            >
              <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{valor}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Todas las programaciones */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">
          Todas las programaciones ({programaciones.length})
        </h2>
        {programaciones.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No hay ninguna.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {programaciones.map((p) => {
              const dias = ORDEN.filter((i) => (JSON.parse(p.diasSemana) as number[]).includes(i));
              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {p.nombre || `${p.biblioteca.nombre} · ${p.planta.nombre}`}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {nombreUsuario(p.usuario)} · {dias.map((i) => DIAS[i]).join(", ")}
                      {p.proximaEjecucion
                        ? ` · próxima ${new Date(p.proximaEjecucion).toLocaleDateString("es-ES")}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.estado === "activa"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : p.estado === "pausada"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                    }`}
                  >
                    {p.estado}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actividad reciente global */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Actividad reciente (todos los usuarios)</h2>
        {actividad.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Sin actividad registrada.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {actividad.map((a) => (
              <div key={a.id} className="flex flex-wrap items-start gap-2 py-2 text-sm">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    EVENTO_ESTILO[a.tipoEvento] ?? "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                  }`}
                >
                  {a.tipoEvento.replace(/_/g, " ")}
                </span>
                <div>
                  <p className="text-slate-700 dark:text-slate-200">{a.mensaje}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {a.usuario?.nombre ?? "—"}
                    {a.programacion?.nombre ? ` · ${a.programacion.nombre}` : ""} ·{" "}
                    {new Date(a.fecha).toLocaleString("es-ES")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
