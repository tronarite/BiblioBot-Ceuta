import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Botón + panel desplegable genérico (sin dependencias): se cierra solo al hacer clic
 * fuera. Se usa para los avisos del dashboard (aviso general, horarios extraordinarios)
 * para que quepan como botones compactos en la franja de controles en vez de ocupar
 * espacio propio siempre visibles.
 */
export function Dropdown({
  label,
  buttonClassName,
  panelClassName,
  children,
}: {
  label: ReactNode;
  buttonClassName: string;
  panelClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={buttonClassName}>
        {label}
      </button>
      {open && (
        <div
          className={`absolute left-0 top-full z-20 mt-2 rounded-xl border bg-white p-4 text-sm shadow-lg dark:bg-slate-800 ${panelClassName ?? ""}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
