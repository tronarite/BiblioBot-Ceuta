import type { ReactNode } from "react";
import { SummarySidebar, type SummaryStep } from "./SummarySidebar";

export function FullScreenPanel({
  title,
  steps,
  onClose,
  footer,
  children,
}: {
  title: string;
  steps: SummaryStep[];
  onClose: () => void;
  /** Barra de acciones fija abajo del todo (botones de volver, cesta, confirmar…). */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-900 md:flex-row md:overflow-hidden">
      <SummarySidebar steps={steps} onClose={onClose} className="md:order-2" />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <h1 className="mb-6 text-xl font-semibold text-slate-800 dark:text-slate-100">{title}</h1>
          {children}
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
