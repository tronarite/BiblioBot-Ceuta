import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { MiniMarkdown } from "../../../components/MiniMarkdown";
import type { HorarioExtraordinario } from "../../../api/types";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";

export function ExtraordinarySchedulesAdmin() {
  const [horarios, setHorarios] = useState<HorarioExtraordinario[]>([]);
  const [texto, setTexto] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState("");
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    api.get<HorarioExtraordinario[]>("/admin/horarios-extraordinarios").then(setHorarios);
  }

  useEffect(cargar, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/admin/horarios-extraordinarios", { texto });
      setTexto("");
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el horario");
    }
  }

  async function guardarEdicion(id: string) {
    setError(null);
    try {
      await api.patch(`/admin/horarios-extraordinarios/${id}`, { texto: textoEditado });
      setEditandoId(null);
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el horario");
    }
  }

  async function eliminar(id: string) {
    await api.del(`/admin/horarios-extraordinarios/${id}`);
    cargar();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Nuevo horario extraordinario</h2>
        <form onSubmit={crear} className="max-w-lg space-y-3">
          {error && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>
          )}
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={'Ej. Cierre por obras del 12 al 14 de septiembre en BP "Adolfo Suárez": horario reducido **10:00-13:00**'}
            required
            rows={4}
            className={`w-full ${inputClass}`}
          />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Admite Markdown básico: **negrita**, *cursiva* y listas con "- ". Indica en el propio texto a qué
            biblioteca(s) y fechas afecta.
          </p>
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Añadir
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Horarios extraordinarios</h2>
        {horarios.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No hay ninguno. Bórralos cuando dejen de aplicar.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {horarios.map((h) => (
              <div key={h.id} className="py-3 text-sm">
                {editandoId === h.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={textoEditado}
                      onChange={(e) => setTextoEditado(e.target.value)}
                      rows={4}
                      className={`w-full ${inputClass}`}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => guardarEdicion(h.id)}
                        disabled={!textoEditado.trim()}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <MiniMarkdown texto={h.texto} className="text-slate-700 dark:text-slate-200" />
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => {
                          setEditandoId(h.id);
                          setTextoEditado(h.texto);
                        }}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminar(h.id)}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
