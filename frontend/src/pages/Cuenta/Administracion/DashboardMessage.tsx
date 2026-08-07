import { useEffect, useState } from "react";
import { api } from "../../../api/client";

export function DashboardMessageAdmin() {
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ texto: string } | null>("/admin/dashboard-message").then((m) => setTexto(m?.texto ?? ""));
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    await api.put("/admin/dashboard-message", { texto });
    setMsg("Mensaje actualizado");
    setTimeout(() => setMsg(null), 2000);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-medium text-slate-800">Mensaje del dashboard</h2>
      <form onSubmit={guardar} className="space-y-3">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Mensaje visible para todos los usuarios en el Dashboard"
        />
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Guardar mensaje</button>
      </form>
    </div>
  );
}
