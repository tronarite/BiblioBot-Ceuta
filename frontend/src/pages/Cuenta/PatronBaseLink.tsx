import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { CuentaPatronBaseStatus } from "../../api/types";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";

export function PatronBaseLink() {
  const [status, setStatus] = useState<CuentaPatronBaseStatus | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  function cargar() {
    api.get<CuentaPatronBaseStatus>("/account/patronbase").then(setStatus);
  }

  useEffect(cargar, []);

  async function vincular(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/account/patronbase/link", { email, password });
      setPassword("");
      setMostrarFormulario(false);
      cargar();
    } catch (err) {
      // No limpiamos email/contraseña: si el fallo fue algo puntual (rate limit, la web
      // caída un momento…), el usuario solo tiene que darle otra vez sin volver a escribir.
      setError(err instanceof Error ? err.message : "No se pudo vincular la cuenta");
    } finally {
      setBusy(false);
    }
  }

  async function reintentar() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/account/patronbase/retry");
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo vincular la cuenta");
    } finally {
      setBusy(false);
    }
  }

  async function desvincular() {
    setBusy(true);
    try {
      await api.del("/account/patronbase/link");
      cargar();
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Cuenta PatronBase</h2>

      {status.estadoVinculacion === "vinculada" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              Vinculada
            </span>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{status.patronbaseEmail}</p>
          </div>
          <button
            onClick={desvincular}
            disabled={busy}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Desvincular
          </button>
        </div>
      ) : status.estadoVinculacion === "error" && !mostrarFormulario ? (
        <div>
          <p className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
            Hubo un problema al iniciar sesión en PatronBase con las últimas credenciales guardadas
            {status.patronbaseEmail ? ` (${status.patronbaseEmail})` : ""}. Puede haber sido algo puntual: prueba a
            reintentar antes de volver a escribir la contraseña.
          </p>
          {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reintentar}
              disabled={busy}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "Comprobando…" : "Reintentar"}
            </button>
            <button
              type="button"
              onClick={() => setMostrarFormulario(true)}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Usar otras credenciales
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Sin una cuenta PatronBase vinculada no puedes crear reservas ni programaciones.
          </p>
          <form onSubmit={vincular} className="grid max-w-md gap-3">
            <input
              type="email"
              placeholder="Email de PatronBase"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
            <input
              type="password"
              placeholder="Contraseña de PatronBase"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "Comprobando…" : "Vincular cuenta"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
