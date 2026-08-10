import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { usuario, adminExists, login, bootstrapAdmin } = useAuth();
  const [mode, setMode] = useState<"login" | "bootstrap">("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (usuario) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "bootstrap") {
        await bootstrapAdmin(nombre, email, password);
      } else {
        await login(identificador, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <h1 className="mb-1 text-2xl font-semibold text-brand-800 dark:text-brand-300">BiblioBot</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">Bibliotecas Públicas de Ceuta</p>

        {adminExists === false && (
          <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-700">
            <button
              className={`flex-1 rounded-md py-1.5 ${
                mode === "login"
                  ? "bg-white font-medium shadow dark:bg-slate-600 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400"
              }`}
              onClick={() => setMode("login")}
              type="button"
            >
              Iniciar sesión
            </button>
            <button
              className={`flex-1 rounded-md py-1.5 ${
                mode === "bootstrap"
                  ? "bg-white font-medium shadow dark:bg-slate-600 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400"
              }`}
              onClick={() => setMode("bootstrap")}
              type="button"
            >
              Crear administrador
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "bootstrap" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
              <input className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
          )}
          {mode === "bootstrap" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email o usuario</label>
              <input
                type="text"
                className={inputClass}
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Contraseña</label>
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "bootstrap" ? 8 : undefined}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Un momento…" : mode === "bootstrap" ? "Crear cuenta de administrador" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
