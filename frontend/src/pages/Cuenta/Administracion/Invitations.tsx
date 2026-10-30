import { useEffect, useState } from "react";
import { api } from "../../../api/client";

type Invitacion = { id: string; codigo: string; createdAt: string; expiraEn: string; usadaPor: string | null };

const enlace = (codigo: string) => `${window.location.origin}/registro/${codigo}`;

function estadoDe(i: Invitacion) {
  if (i.usadaPor) return `Usada por ${i.usadaPor}`;
  if (new Date(i.expiraEn).getTime() < Date.now()) return "Caducada";
  return `Vigente hasta el ${new Date(i.expiraEn).toLocaleDateString("es-ES")}`;
}

export function InvitationsAdmin() {
  const [items, setItems] = useState<Invitacion[]>([]);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    api.get<Invitacion[]>("/admin/invitaciones").then(setItems).catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }
  useEffect(cargar, []);

  async function generar() {
    setError(null);
    try {
      await api.post("/admin/invitaciones");
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el enlace");
    }
  }

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(enlace(codigo));
      setCopiado(codigo);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      window.prompt("Copia el enlace:", enlace(codigo));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-1 font-medium text-slate-800 dark:text-slate-100">Invitar a una persona</h2>
        <p className="mb-3 max-w-xl text-sm text-slate-500 dark:text-slate-400">
          El enlace es de un solo uso y dura 7 días. La persona crea su cuenta con su email y contraseña de PatronBase
          y queda como tu amiga automáticamente.
        </p>
        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button onClick={generar} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Generar enlace
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Enlaces generados</h2>
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Todavía no has generado ninguno.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {items.map((i) => {
              const vigente = !i.usadaPor && new Date(i.expiraEn).getTime() >= Date.now();
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-slate-700 dark:text-slate-200">{estadoDe(i)}</p>
                    {vigente && <p className="truncate text-xs text-slate-400 dark:text-slate-500">{enlace(i.codigo)}</p>}
                  </div>
                  <div className="flex gap-2">
                    {vigente && (
                      <button
                        onClick={() => copiar(i.codigo)}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        {copiado === i.codigo ? "Copiado" : "Copiar enlace"}
                      </button>
                    )}
                    <button
                      onClick={() => api.del(`/admin/invitaciones/${i.id}`).then(cargar)}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      {vigente ? "Anular" : "Borrar"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
