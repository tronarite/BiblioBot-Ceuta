import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import type { Biblioteca, HorarioExtraordinario } from "../../../api/types";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";

export function ExtraordinarySchedulesAdmin() {
  const [horarios, setHorarios] = useState<HorarioExtraordinario[]>([]);
  const [bibliotecas, setBibliotecas] = useState<Biblioteca[]>([]);
  const [bibliotecaId, setBibliotecaId] = useState("");
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [horario, setHorario] = useState("");

  function cargar() {
    api.get<HorarioExtraordinario[]>("/admin/horarios-extraordinarios").then(setHorarios);
    api.get<Biblioteca[]>("/libraries").then((libs) => {
      setBibliotecas(libs);
      if (!bibliotecaId && libs[0]) setBibliotecaId(libs[0].id);
    });
  }

  useEffect(cargar, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/admin/horarios-extraordinarios", { bibliotecaId, fecha, descripcion, horario });
    setFecha("");
    setDescripcion("");
    setHorario("");
    cargar();
  }

  async function eliminar(id: string) {
    await api.del(`/admin/horarios-extraordinarios/${id}`);
    cargar();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Nuevo horario extraordinario</h2>
        <form onSubmit={crear} className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            value={bibliotecaId}
            onChange={(e) => setBibliotecaId(e.target.value)}
            className={`sm:col-span-2 ${inputClass}`}
          >
            {bibliotecas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={inputClass} />
          <input
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            placeholder="Horario (ej. 10:00-13:00)"
            required
            className={inputClass}
          />
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción"
            required
            className={`sm:col-span-2 ${inputClass}`}
          />
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 sm:col-span-2">
            Añadir
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Horarios activos o próximos</h2>
        {horarios.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No hay ninguno programado.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {horarios.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {h.biblioteca.nombre} · {new Date(h.fecha).toLocaleDateString("es-ES")}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {h.descripcion} ({h.horario})
                  </p>
                </div>
                <button
                  onClick={() => eliminar(h.id)}
                  className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
