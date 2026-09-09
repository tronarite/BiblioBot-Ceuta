import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Biblioteca } from "../../api/types";

export function VisibleLibraries() {
  const { usuario, refresh } = useAuth();
  const [bibliotecas, setBibliotecas] = useState<Biblioteca[]>([]);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Biblioteca[]>("/libraries").then(setBibliotecas);
  }, []);

  const ocultas = usuario?.bibliotecasOcultas ?? [];

  async function toggle(bibliotecaId: string) {
    setError(null);
    setGuardando(bibliotecaId);
    const nuevasOcultas = ocultas.includes(bibliotecaId)
      ? ocultas.filter((id) => id !== bibliotecaId)
      : [...ocultas, bibliotecaId];
    try {
      await api.patch("/account/me", { bibliotecasOcultas: nuevasOcultas });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-1 font-medium text-slate-800 dark:text-slate-100">Bibliotecas visibles</h2>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        Elige qué bibliotecas te interesan. Las que desmarques desaparecen de toda la app: del dashboard, de
        "Hacer una reserva" y de las programaciones nuevas. Puedes volver a marcarlas cuando quieras.
      </p>
      {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="space-y-2">
        {bibliotecas.map((b) => (
          <label key={b.id} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={!ocultas.includes(b.id)}
              disabled={guardando === b.id}
              onChange={() => toggle(b.id)}
            />
            {b.nombre}
          </label>
        ))}
      </div>
    </div>
  );
}
