import { useState } from "react";
import { Link } from "react-router-dom";
import { DashboardMessageAdmin } from "./DashboardMessage";
import { ExtraordinarySchedulesAdmin } from "./ExtraordinarySchedules";
import { UsersAdmin } from "./Users";

const TABS = [
  { id: "usuarios", label: "Cuentas BiblioBot" },
  { id: "mensaje", label: "Mensaje del dashboard" },
  { id: "horarios", label: "Horarios extraordinarios" },
] as const;

export function AdministracionPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("usuarios");

  return (
    <div className="space-y-6">
      <div>
        <Link to="/cuenta" className="text-sm text-slate-500 hover:underline">
          ← Cuenta
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">Administración</h1>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 ${tab === t.id ? "bg-white shadow font-medium" : "text-slate-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "usuarios" && <UsersAdmin />}
      {tab === "mensaje" && <DashboardMessageAdmin />}
      {tab === "horarios" && <ExtraordinarySchedulesAdmin />}
    </div>
  );
}
