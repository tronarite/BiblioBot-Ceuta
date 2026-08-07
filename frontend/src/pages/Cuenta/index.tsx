import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { ActivityLog } from "./ActivityLog";
import { PatronBaseLink } from "./PatronBaseLink";

export function CuentaPage() {
  const { usuario, refresh } = useAuth();
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await api.patch("/account/me", {
        nombre,
        email,
        ...(passwordNueva ? { passwordActual, passwordNueva } : {}),
      });
      setPasswordActual("");
      setPasswordNueva("");
      setMsg("Datos actualizados");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Cuenta</h1>
        {usuario?.rol === "admin" && (
          <Link to="/cuenta/administracion" className="text-sm font-medium text-brand-600 hover:underline">
            Ir a Administración →
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-medium text-slate-800">Tus datos</h2>
        <form onSubmit={guardar} className="grid max-w-md gap-3">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Nombre" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Email" />
          <hr className="my-1 border-slate-100" />
          <input
            value={passwordActual}
            onChange={(e) => setPasswordActual(e.target.value)}
            type="password"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Contraseña actual (para cambiarla)"
          />
          <input
            value={passwordNueva}
            onChange={(e) => setPasswordNueva(e.target.value)}
            type="password"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Nueva contraseña"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
          <button disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </div>

      <PatronBaseLink />
      <ActivityLog />
    </div>
  );
}
