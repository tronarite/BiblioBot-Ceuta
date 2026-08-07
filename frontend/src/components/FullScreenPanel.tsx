import type { ReactNode } from "react";
import { SummarySidebar, type SummaryStep } from "./SummarySidebar";

export function FullScreenPanel({
  title,
  steps,
  onClose,
  children,
}: {
  title: string;
  steps: SummaryStep[];
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-900 md:flex-row md:overflow-hidden">
      <SummarySidebar steps={steps} onClose={onClose} className="md:order-2" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <h1 className="mb-6 text-xl font-semibold text-slate-800 dark:text-slate-100">{title}</h1>
        {children}
      </div>
    </div>
  );
}
