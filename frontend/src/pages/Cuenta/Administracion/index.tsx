import { useState } from "react";
import { Link } from "react-router-dom";
import { DashboardMessageAdmin } from "./DashboardMessage";
import { ExtraordinarySchedulesAdmin } from "./ExtraordinarySchedules";
import { SystemStatusAdmin } from "./SystemStatus";
import { UsersAdmin } from "./Users";

const TABS = [
  { id: "estado", label: "Estado del sistema" },
  { id: "usuarios", label: "Cuentas BiblioBot" },
  { id: "mensaje", label: "Mensaje del dashboard" },
  { id: "horarios", label: "Horarios extraordinarios" },
] as const;

export function AdministracionPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("estado");

  return (
    <div className="space-y-6">
      <div>
        <Link to="/cuenta" className="text-sm text-slate-500 hover:underline dark:text-slate-400">
          ← Cuenta
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-800 dark:text-slate-100">Administración</h1>
      </div>

      <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 ${
              tab === t.id
                ? "bg-white font-medium shadow dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "estado" && <SystemStatusAdmin />}
      {tab === "usuarios" && <UsersAdmin />}
      {tab === "mensaje" && <DashboardMessageAdmin />}
      {tab === "horarios" && <ExtraordinarySchedulesAdmin />}
    </div>
  );
}
