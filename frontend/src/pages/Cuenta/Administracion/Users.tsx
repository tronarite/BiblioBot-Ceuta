import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import type { Usuario } from "../../../api/types";

export function UsersAdmin() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<"usuario" | "admin">("usuario");
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    api.get<Usuario[]>("/admin/usuarios").then(setUsuarios);
  }

  useEffect(cargar, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/admin/usuarios", { nombre, email, password, rol });
      setNombre("");
      setEmail("");
      setPassword("");
      setRol("usuario");
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario");
    }
  }

  async function toggleActivo(u: Usuario) {
    await api.patch(`/admin/usuarios/${u.id}`, { activo: !u.activo });
    cargar();
  }

  async function eliminar(u: Usuario) {
    await api.del(`/admin/usuarios/${u.id}`);
    cargar();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-medium text-slate-800">Crear cuenta</h2>
        <form onSubmit={crear} className="grid max-w-lg grid-cols-2 gap-3">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" required className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Contraseña temporal" required minLength={8} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select value={rol} onChange={(e) => setRol(e.target.value as "usuario" | "admin")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="usuario">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
          <button className="col-span-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Crear cuenta</button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-medium text-slate-800">Cuentas existentes</h2>
        <div className="divide-y divide-slate-100">
          {usuarios.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-slate-800">
                  {u.nombre} <span className="ml-2 text-xs text-slate-400">{u.rol}</span>
                </p>
                <p className="text-slate-500">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${u.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {u.activo ? "Activo" : "Inactivo"}
                </span>
                <button onClick={() => toggleActivo(u)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">
                  {u.activo ? "Desactivar" : "Activar"}
                </button>
                <button onClick={() => eliminar(u)} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
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
