import { Fragment, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Biblioteca, Programacion } from "../../api/types";
import { ScheduleCard } from "../../components/ScheduleCard";
import { ScheduleWizard } from "./ScheduleWizard";

export function ProgramacionesPage() {
  const { usuario } = useAuth();
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  const [bibliotecas, setBibliotecas] = useState<Biblioteca[]>([]);
  const [wizardTarget, setWizardTarget] = useState<"nueva" | Programacion | null>(null);

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

  async function togglePause(p: Programacion) {
    await api.patch(`/schedules/${p.id}`, { estado: p.estado === "activa" ? "pausada" : "activa" });
    cargar();
  }

  async function eliminar(p: Programacion) {
    await api.del(`/schedules/${p.id}`);
    cargar();
  }

  async function renombrar(p: Programacion, nombre: string) {
    await api.patch(`/schedules/${p.id}`, { nombre });
    cargar();
  }

  return (
    <Fragment>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Programaciones</h1>
        <button
          onClick={() => setWizardTarget("nueva")}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Nueva programación
        </button>
      </div>

      {programaciones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
          No tienes programaciones. Crea la primera para que BiblioBot reserve tu puesto automáticamente.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {programaciones.map((p) => (
            <ScheduleCard
              key={p.id}
              programacion={p}
              onTogglePause={() => togglePause(p)}
              onDelete={() => eliminar(p)}
              onRename={(nombre) => renombrar(p, nombre)}
              onEdit={() => setWizardTarget(p)}
            />
          ))}
        </div>
      )}
    </div>

      {wizardTarget && (
        <ScheduleWizard
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
