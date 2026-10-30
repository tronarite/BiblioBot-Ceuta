import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";

export function RegistroPage() {
  const { codigo = "" } = useParams();
  const { usuario, refresh } = useAuth();
  const navigate = useNavigate();
  const [invitadoPor, setInvitadoPor] = useState<string | null>(null);
  const [invalida, setInvalida] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ invitadoPor: string }>(`/auth/invitacion/${encodeURIComponent(codigo)}`)
      .then((r) => setInvitadoPor(r.invitadoPor))
      .catch(() => setInvalida(true));
  }, [codigo]);

  if (usuario) return <Navigate to="/dashboard" replace />;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post(`/auth/registro/${encodeURIComponent(codigo)}`, { nombre, email, password });
      await refresh();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <h1 className="mb-1 text-2xl font-semibold text-brand-800 dark:text-brand-300">BiblioBot</h1>
        {invalida ? (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Este enlace de invitación no es válido o ha caducado. Pide uno nuevo a quien te invitó.
          </p>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              {invitadoPor ? `${invitadoPor} te ha invitado.` : "Comprobando invitación…"} Crea tu cuenta con tu email y
              contraseña de PatronBase: son los mismos que usarás aquí.
            </p>
            <form onSubmit={enviar} className="space-y-4">
              <div>
                <label htmlFor="reg-nombre" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
                <input id="reg-nombre" className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="reg-email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email de PatronBase</label>
                <input id="reg-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="reg-pass" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Contraseña de PatronBase</label>
                <input id="reg-pass" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy || !invitadoPor}
                className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "Comprobando en PatronBase…" : "Crear mi cuenta"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
