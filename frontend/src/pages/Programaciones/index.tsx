import { Fragment, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useCuentas } from "../../auth/CuentaContext";
import type { Biblioteca, Programacion } from "../../api/types";
import { BotonConCuenta } from "../../components/BotonConCuenta";
import { ScheduleCard } from "../../components/ScheduleCard";
import { ScheduleWizard } from "./ScheduleWizard";

const BTN_SEC =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";
const INPUT =
  "min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export function ProgramacionesPage() {
  const { usuario } = useAuth();
  const { vistaTodas } = useCuentas();
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  const [bibliotecas, setBibliotecas] = useState<Biblioteca[]>([]);
  const [wizardTarget, setWizardTarget] = useState<"nueva" | Programacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  // En la vista «Todas las cuentas» el botón de nueva programación pregunta con cuál.
  const [cuentaNueva, setCuentaNueva] = useState<string | undefined>();
  // Modo "agrupar": ids marcados, nombre del grupo nuevo y grupo existente al que añadir.
  const [agrupando, setAgrupando] = useState(false);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [grupoDestino, setGrupoDestino] = useState("");
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [borradorGrupo, setBorradorGrupo] = useState("");

  const ocultas = usuario?.bibliotecasOcultas ?? [];
  const bibliotecasVisibles = bibliotecas.filter((b) => !ocultas.includes(b.id));

  async function cargar() {
    const [progs, libs] = await Promise.all([
      api.get<Programacion[]>("/schedules"),
      api.get<Biblioteca[]>("/libraries"),
    ]);
    setProgramaciones(progs);
    setBibliotecas(libs);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    }
    cargar();
  }

  const togglePause = (p: Programacion) =>
    accion(() => api.patch(`/schedules/${p.id}`, { estado: p.estado === "activa" ? "pausada" : "activa" }));
  const eliminar = (p: Programacion) => accion(() => api.del(`/schedules/${p.id}`));
  const renombrar = (p: Programacion, nombre: string) => accion(() => api.patch(`/schedules/${p.id}`, { nombre }));

  function salirAgrupar() {
    setAgrupando(false);
    setMarcadas([]);
    setNombreGrupo("");
    setGrupoDestino("");
  }

  async function crearGrupo() {
    await accion(() => api.post("/schedules/grupos", { nombre: nombreGrupo.trim(), ids: marcadas }));
    salirAgrupar();
  }

  async function anadirAGrupo() {
    await accion(() => api.post(`/schedules/grupos/${grupoDestino}/miembros`, { ids: marcadas }));
    salirAgrupar();
  }

  function guardarNombreGrupo(id: string, actual: string) {
    const limpio = borradorGrupo.trim();
    setRenombrando(null);
    if (limpio && limpio !== actual) accion(() => api.patch(`/schedules/grupos/${id}`, { nombre: limpio }));
  }

  const grupos = new Map<string, { id: string; nombre: string; miembros: Programacion[] }>();
  for (const p of programaciones) {
    if (!p.grupo) continue;
    const g = grupos.get(p.grupo.id) ?? { ...p.grupo, miembros: [] };
    g.miembros.push(p);
    grupos.set(p.grupo.id, g);
  }
  const sueltas = programaciones.filter((p) => !p.grupo);

  return (
    <Fragment>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Programaciones</h1>
          <div className="flex gap-2">
            {programaciones.length >= 2 && (
              <button
                onClick={() => (agrupando ? salirAgrupar() : setAgrupando(true))}
                className={`${BTN_SEC} px-4 py-2 text-sm`}
              >
                {agrupando ? "Cancelar" : "Agrupar"}
              </button>
            )}
            <BotonConCuenta
              onElegir={(id) => {
                setCuentaNueva(id);
                setWizardTarget("nueva");
              }}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Nueva programación
            </BotonConCuenta>
          </div>
        </div>

        {agrupando && (
          <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm dark:border-brand-800 dark:bg-brand-900/20">
            <p className="text-slate-700 dark:text-slate-200">
              Marca las programaciones sueltas que quieras agrupar ({marcadas.length} elegidas). El grupo tendrá un único
              botón para pausarlas o reanudarlas todas.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={nombreGrupo}
                onChange={(e) => setNombreGrupo(e.target.value)}
                maxLength={80}
                placeholder="Nombre del grupo"
                className={INPUT}
              />
              <button
                onClick={crearGrupo}
                disabled={marcadas.length < 2 || !nombreGrupo.trim()}
                className="rounded-lg bg-brand-600 px-4 py-1.5 font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Crear grupo
              </button>
            </div>
            {grupos.size > 0 && (
              <div className="flex flex-wrap gap-2">
                <select value={grupoDestino} onChange={(e) => setGrupoDestino(e.target.value)} className={INPUT}>
                  <option value="">…o añadir a un grupo existente</option>
                  {[...grupos.values()].map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre}
                    </option>
                  ))}
                </select>
                <button onClick={anadirAGrupo} disabled={marcadas.length < 1 || !grupoDestino} className={BTN_SEC}>
                  Añadir
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {programaciones.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
            No tienes programaciones. Crea la primera para que BiblioBot reserve tu puesto automáticamente.
          </div>
        ) : (
          <div className="space-y-6">
            {[...grupos.values()].map((g) => {
              const hayActiva = g.miembros.some((m) => m.estado === "activa");
              const todasFinalizadas = g.miembros.every((m) => m.estado === "finalizada");
              return (
                <div
                  key={g.id}
                  className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {renombrando === g.id ? (
                      <input
                        autoFocus
                        value={borradorGrupo}
                        onChange={(e) => setBorradorGrupo(e.target.value)}
                        onBlur={() => guardarNombreGrupo(g.id, g.nombre)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") guardarNombreGrupo(g.id, g.nombre);
                          if (e.key === "Escape") setRenombrando(null);
                        }}
                        maxLength={80}
                        className="rounded-md border border-brand-300 bg-white px-2 py-0.5 text-sm font-semibold dark:border-brand-600 dark:bg-slate-700 dark:text-slate-100"
                      />
                    ) : (
                      <button
                        type="button"
                        title="Cambiar nombre del grupo"
                        onClick={() => {
                          setBorradorGrupo(g.nombre);
                          setRenombrando(g.id);
                        }}
                        className="truncate text-left text-sm font-semibold text-slate-800 hover:underline dark:text-slate-100"
                      >
                        {g.nombre}{" "}
                        <span className="font-normal text-slate-400">· {g.miembros.length} programaciones</span>
                      </button>
                    )}
                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={() =>
                          accion(() => api.patch(`/schedules/grupos/${g.id}`, { estado: hayActiva ? "pausada" : "activa" }))
                        }
                        disabled={todasFinalizadas}
                        className={BTN_SEC}
                      >
                        {hayActiva ? "Pausar grupo" : "Reanudar grupo"}
                      </button>
                      <button onClick={() => accion(() => api.del(`/schedules/grupos/${g.id}`))} className={BTN_SEC}>
                        Deshacer grupo
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {g.miembros.map((p) => (
                      <ScheduleCard
                        key={p.id}
                        programacion={p}
                        enGrupo
                        onLeaveGroup={() => accion(() => api.del(`/schedules/${p.id}/grupo`))}
                        onTogglePause={() => togglePause(p)}
                        onDelete={() => eliminar(p)}
                        onRename={(nombre) => renombrar(p, nombre)}
                        onEdit={() => setWizardTarget(p)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {sueltas.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {sueltas.map((p) => (
                  <ScheduleCard
                    key={p.id}
                    programacion={p}
                    seleccion={
                      agrupando
                        ? {
                            marcada: marcadas.includes(p.id),
                            onToggle: () =>
                              setMarcadas((m) => (m.includes(p.id) ? m.filter((x) => x !== p.id) : [...m, p.id])),
                          }
                        : null
                    }
                    onTogglePause={() => togglePause(p)}
                    onDelete={() => eliminar(p)}
                    onRename={(nombre) => renombrar(p, nombre)}
                    onEdit={() => setWizardTarget(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {wizardTarget && (
        <ScheduleWizard
          cuentaId={vistaTodas ? (wizardTarget === "nueva" ? cuentaNueva : (wizardTarget.cuentaId ?? undefined)) : undefined}
          // Al crear una nueva programación solo se ofrecen las bibliotecas visibles;
          // al editar una ya existente se pasan todas, para no romper la edición si su
          // biblioteca se ocultó después de crearla.
          bibliotecas={wizardTarget === "nueva" ? bibliotecasVisibles : bibliotecas}
          programacion={wizardTarget === "nueva" ? null : wizardTarget}
          onClose={() => setWizardTarget(null)}
          onCreated={() => {
            setWizardTarget(null);
            cargar();
          }}
        />
      )}
    </Fragment>
  );
}
