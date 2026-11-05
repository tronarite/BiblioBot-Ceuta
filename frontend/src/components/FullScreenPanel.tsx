import { useEffect, type ReactNode } from "react";
import { SummarySidebar, type SummaryStep } from "./SummarySidebar";

type PuenteApp = { setPullRefresh?: (activo: boolean) => void };
const puenteApp = () => (window as unknown as { BiblioBotNative?: PuenteApp }).BiblioBotNative;

export function FullScreenPanel({
  title,
  subtitle,
  steps,
  onClose,
  footer,
  children,
}: {
  title: string;
  /** Al otro lado del título, en la misma línea (p. ej. la cuenta con la que se está operando). */
  subtitle?: ReactNode;
  steps: SummaryStep[];
  onClose: () => void;
  /** Barra de acciones fija abajo del todo (botones de volver, cesta, confirmar…). */
  footer?: ReactNode;
  children: ReactNode;
}) {
  // En la app, deslizar hacia abajo al principio del contenido recarga la página (gesto de
  // "tirar para refrescar" nativo). Dentro de un asistente el scroll es interno y ese gesto
  // se disparaba al subir: se desactiva mientras el panel está abierto.
  useEffect(() => {
    puenteApp()?.setPullRefresh?.(false);
    return () => puenteApp()?.setPullRefresh?.(true);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-y-contain bg-slate-50 dark:bg-slate-900 md:flex-row md:overflow-hidden">
      <SummarySidebar steps={steps} onClose={onClose} className="md:order-2" />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{title}</h1>
            {subtitle}
          </div>
          <div className="mt-6">{children}</div>
        </div>
        {footer && (
          <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-800 sm:px-8 md:static">
            <div className="flex flex-wrap items-center gap-3">{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
}
