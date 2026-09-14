import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ForcePasswordChange } from "../auth/ForcePasswordChange";
import { useTheme, type Modo } from "../theme/ThemeContext";

const tabs = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/programaciones", label: "Programaciones" },
  { to: "/cuenta", label: "Cuenta" },
];

const SolIcono = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path
      fillRule="evenodd"
      d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"
      clipRule="evenodd"
    />
  </svg>
);

const LunaIcono = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path
      fillRule="evenodd"
      d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
      clipRule="evenodd"
    />
  </svg>
);

// Círculo medio relleno: icono habitual para "seguir al sistema".
const AutoIcono = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 3a9 9 0 000 18V3z" fill="currentColor" />
  </svg>
);

const OPCIONES: { valor: Modo; label: string; icono: JSX.Element }[] = [
  { valor: "light", label: "Modo claro", icono: SolIcono },
  { valor: "auto", label: "Automático (según el dispositivo)", icono: AutoIcono },
  { valor: "dark", label: "Modo oscuro", icono: LunaIcono },
];

function ThemeToggle() {
  const { modo, setModo } = useTheme();
  return (
    <div
      role="group"
      aria-label="Tema de la aplicación"
      className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-700"
    >
      {OPCIONES.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          onClick={() => setModo(opcion.valor)}
          aria-label={opcion.label}
          aria-pressed={modo === opcion.valor}
          title={opcion.label}
          className={`rounded-md p-1.5 transition ${
            modo === opcion.valor
              ? "bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {opcion.icono}
        </button>
      ))}
    </div>
  );
}

export function AppLayout() {
  const { usuario, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (usuario?.debeCambiarPassword) return <ForcePasswordChange />;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      isActive
        ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
    }`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <span className="text-lg font-semibold text-brand-800 dark:text-brand-300">BiblioBot</span>
            <nav className="hidden gap-1 sm:flex">
              {tabs.map((tab) => (
                <NavLink key={tab.to} to={tab.to} className={navLinkClass}>
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-3 text-sm text-slate-600 dark:text-slate-300 sm:flex">
            <ThemeToggle />
            <span>{usuario?.nombre}</span>
            <button
              onClick={() => logout()}
              className="rounded-lg px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              Salir
            </button>
          </div>

          <div className="flex items-center gap-1 sm:hidden">
            <ThemeToggle />
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700 sm:hidden">
            <nav className="flex flex-col gap-1">
              {tabs.map((tab) => (
                <NavLink key={tab.to} to={tab.to} className={navLinkClass} onClick={() => setMenuOpen(false)}>
                  {tab.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <span>{usuario?.nombre}</span>
              <button
                onClick={() => logout()}
                className="rounded-lg px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                Salir
              </button>
            </div>
          </div>
        )}
      </header>

      {usuario?.patronbaseEstado === "error" && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
          No hemos podido entrar en tu cuenta de PatronBase con las credenciales guardadas: tus reservas y
          programaciones no funcionarán.{" "}
          <Link to="/cuenta" className="font-medium underline">
            Vuelve a vincularla
          </Link>
          .
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
