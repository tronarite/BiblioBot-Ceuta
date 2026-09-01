import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import { MiniMarkdown } from "../../../components/MiniMarkdown";
import type { Biblioteca, HorarioExtraordinario } from "../../../api/types";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";

function formatearRango(fechaInicio: string, fechaFin: string): string {
  const inicio = new Date(fechaInicio).toLocaleDateString("es-ES");
  if (fechaInicio === fechaFin) return inicio;
  return `${inicio} – ${new Date(fechaFin).toLocaleDateString("es-ES")}`;
}

export function ExtraordinarySchedulesAdmin() {
  const [horarios, setHorarios] = useState<HorarioExtraordinario[]>([]);
  const [bibliotecas, setBibliotecas] = useState<Biblioteca[]>([]);
  const [bibliotecaIds, setBibliotecaIds] = useState<string[]>([]);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    api.get<HorarioExtraordinario[]>("/admin/horarios-extraordinarios").then(setHorarios);
    api.get<Biblioteca[]>("/libraries").then(setBibliotecas);
  }

  useEffect(cargar, []);

  function toggleBiblioteca(id: string) {
    setBibliotecaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (bibliotecaIds.length === 0) {
      setError("Selecciona al menos una biblioteca");
      return;
    }
    const entradas = bibliotecaIds.map((bibliotecaId) => ({ bibliotecaId, texto: (textos[bibliotecaId] ?? "").trim() }));
    if (entradas.some((entrada) => !entrada.texto)) {
      setError("Escribe el horario de cada biblioteca seleccionada");
      return;
    }
    try {
      await api.post("/admin/horarios-extraordinarios", { fechaInicio, fechaFin: fechaFin || fechaInicio, entradas });
      setBibliotecaIds([]);
      setTextos({});
      setFechaInicio("");
      setFechaFin("");
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el horario");
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

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Bibliotecas</label>
            <div className="space-y-2">
              {bibliotecas.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={bibliotecaIds.includes(b.id)}
                    onChange={() => toggleBiblioteca(b.id)}
                  />
                  {b.nombre}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => {
                  setFechaInicio(e.target.value);
                  if (fechaFin && fechaFin < e.target.value) setFechaFin(e.target.value);
                }}
                required
                className={`w-full ${inputClass}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Fecha fin (opcional)
              </label>
              <input
                type="date"
                value={fechaFin}
                min={fechaInicio || undefined}
                onChange={(e) => setFechaFin(e.target.value)}
                className={`w-full ${inputClass}`}
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Si lo dejas en blanco, se aplica solo el día de inicio.
              </p>
            </div>
          </div>

          {bibliotecaIds.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Horario de cada biblioteca (cada una puede tener uno distinto)
              </p>
              {bibliotecas
                .filter((b) => bibliotecaIds.includes(b.id))
                .map((b) => (
                  <div key={b.id}>
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      {b.nombre}
                    </label>
                    <textarea
                      value={textos[b.id] ?? ""}
                      onChange={(e) => setTextos((prev) => ({ ...prev, [b.id]: e.target.value }))}
                      placeholder={"Ej. Horario reducido: **10:00-13:00** por obras en la sala"}
                      required
                      rows={3}
                      className={`w-full ${inputClass}`}
                    />
                  </div>
                ))}
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Admite Markdown básico: **negrita**, *cursiva* y listas con "- ".
              </p>
            </div>
          )}

          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
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
              <div key={h.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {h.biblioteca.nombre} · {formatearRango(h.fechaInicio, h.fechaFin)}
                  </p>
                  <MiniMarkdown texto={h.texto} className="text-slate-500 dark:text-slate-400" />
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
