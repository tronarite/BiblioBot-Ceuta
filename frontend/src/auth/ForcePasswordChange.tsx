import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

/**
 * Pantalla bloqueante que se muestra cuando un admin ha restablecido la contraseña del
 * usuario (debeCambiarPassword): no deja usar el resto de la app hasta que la cambia.
 */
export function ForcePasswordChange() {
  const { refresh, logout } = useAuth();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (nueva.length < 8) return setError("La nueva contraseña debe tener al menos 8 caracteres.");
    if (nueva !== repetir) return setError("Las dos contraseñas nuevas no coinciden.");
    setBusy(true);
    try {
      await api.patch("/account/me", { passwordActual: actual, passwordNueva: nueva });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <h1 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-100">Cambia tu contraseña</h1>
        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
          Un administrador ha restablecido tu contraseña. Elige una nueva para continuar.
        </p>
        <form onSubmit={guardar} className="space-y-3">
          <input
            type="password"
            placeholder="Contraseña temporal"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            required
            className={inputClass}
          />
          <input
            type="password"
            placeholder="Nueva contraseña"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            required
            minLength={8}
            className={inputClass}
          />
          <input
            type="password"
            placeholder="Repite la nueva contraseña"
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            required
            className={inputClass}
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Guardando…" : "Guardar y continuar"}
          </button>
        </form>
        <button
          onClick={() => logout()}
          className="mt-4 text-xs text-slate-400 hover:underline dark:text-slate-500"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
