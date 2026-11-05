import { useEffect, useRef, useState, type ReactNode } from "react";
import { nombreCuenta, useCuentas } from "../auth/CuentaContext";

/**
 * Botón de acción que, en la vista «Todas las cuentas», despliega justo debajo la lista de
 * cuentas para elegir con cuál actuar. Con una cuenta concreta activa es un botón normal.
 */
export function BotonConCuenta({
  className,
  children,
  onElegir,
}: {
  className: string;
  children: ReactNode;
  /** Recibe el id de la cuenta elegida, o undefined si no hay que elegir (cuenta activa). */
  onElegir: (cuentaId?: string) => void;
}) {
  const { cuentas, vistaTodas } = useCuentas();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  if (!vistaTodas) {
    return (
      <button type="button" onClick={() => onElegir()} className={className}>
        {children}
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-haspopup="menu" aria-expanded={abierto} className={className}>
        {children}
      </button>
      {abierto && (
        // En móvil (y en la app) la lista sale centrada en pantalla, con fondo atenuado;
        // en pantallas anchas se despliega bajo el propio botón.
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:z-30 sm:mt-2 sm:block sm:bg-transparent sm:p-0"
          onClick={() => setAbierto(false)}
        >
          <div
            role="menu"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800 sm:w-64 sm:shadow-lg"
          >
            <p className="px-3 pb-1 pt-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">Con la cuenta…</p>
            {cuentas.map((c) => (
              <button
                key={c.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setAbierto(false);
                  onElegir(c.id);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-3 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700 sm:py-2"
              >
                <span className="truncate">{nombreCuenta(c)}</span>
                {c.principal && <span className="shrink-0 text-xs text-slate-400">principal ★</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
