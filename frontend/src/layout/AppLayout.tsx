import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const tabs = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/programaciones", label: "Programaciones" },
  { to: "/cuenta", label: "Cuenta" },
];

export function AppLayout() {
  const { usuario, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <span className="text-lg font-semibold text-brand-800">BiblioBot</span>
            <nav className="flex gap-1">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{usuario?.nombre}</span>
            <button onClick={() => logout()} className="rounded-lg px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100">
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
