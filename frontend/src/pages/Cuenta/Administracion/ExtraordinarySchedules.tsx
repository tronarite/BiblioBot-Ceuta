import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import type { Biblioteca, HorarioExtraordinario } from "../../../api/types";

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
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-medium text-slate-800">Nuevo horario extraordinario</h2>
        <form onSubmit={crear} className="grid max-w-lg grid-cols-2 gap-3">
          <select value={bibliotecaId} onChange={(e) => setBibliotecaId(e.target.value)} className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {bibliotecas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Horario (ej. 10:00-13:00)" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción" required className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button className="col-span-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Añadir</button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-medium text-slate-800">Horarios activos o próximos</h2>
        {horarios.length === 0 ? (
          <p className="text-sm text-slate-400">No hay ninguno programado.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {horarios.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">
                    {h.biblioteca.nombre} · {new Date(h.fecha).toLocaleDateString("es-ES")}
                  </p>
                  <p className="text-slate-500">
                    {h.descripcion} ({h.horario})
                  </p>
                </div>
                <button onClick={() => eliminar(h.id)} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
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
