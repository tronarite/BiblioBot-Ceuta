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
    <div className="fixed inset-0 z-50 flex bg-slate-50">
      <div className="flex-1 overflow-y-auto p-8">
        <h1 className="mb-6 text-xl font-semibold text-slate-800">{title}</h1>
        {children}
      </div>
      <SummarySidebar steps={steps} onClose={onClose} />
    </div>
  );
}
