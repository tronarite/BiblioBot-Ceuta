import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import type { Usuario } from "../../../api/types";
import { InvitationsAdmin } from "./Invitations";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";

export function UsersAdmin() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    api.get<Usuario[]>("/admin/usuarios").then(setUsuarios);
  }

  useEffect(cargar, []);

  async function toggleActivo(u: Usuario) {
    await api.patch(`/admin/usuarios/${u.id}`, { activo: !u.activo });
    cargar();
  }

  async function eliminar(u: Usuario) {
    await api.del(`/admin/usuarios/${u.id}`);
    cargar();
  }

  async function restablecer(u: Usuario) {
    const { passwordTemporal } = await api.post<{ passwordTemporal: string }>(
      `/admin/usuarios/${u.id}/reset-password`,
      {},
    );
    window.alert(
      `Contraseña temporal de ${u.nombre}:\n\n${passwordTemporal}\n\nComunícasela. Se le pedirá que la cambie al entrar.`,
    );
    cargar();
  }

  return (
    <div className="space-y-6">
      <InvitationsAdmin />

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Cuentas existentes</h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {usuarios.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {u.nombre} <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{u.rol}</span>
                </p>
                <p className="text-slate-500 dark:text-slate-400">{u.email ?? u.username}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    u.activo
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                  }`}
                >
                  {u.activo ? "Activo" : "Inactivo"}
                </span>
                <button
                  onClick={() => restablecer(u)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Restablecer contraseña
                </button>
                <button
                  onClick={() => toggleActivo(u)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {u.activo ? "Desactivar" : "Activar"}
                </button>
                <button
                  onClick={() => eliminar(u)}
                  className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
