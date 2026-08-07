export type SummaryStep = {
  label: string;
  value: string | null;
  onEdit?: () => void;
};

export function SummarySidebar({
  steps,
  onClose,
  className = "",
}: {
  steps: SummaryStep[];
  onClose: () => void;
  className?: string;
}) {
  return (
    <aside
      className={`flex w-full shrink-0 flex-col border-b border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 sm:p-5 md:w-72 md:overflow-y-auto md:border-b-0 md:border-l ${className}`}
    >
      <div className="mb-4 flex items-center justify-between md:mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tu selección</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 md:grid-cols-1 md:gap-4">
        {steps.map((step, i) => (
          <li key={step.label} className="text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {i + 1}. {step.label}
              </span>
              {step.value && step.onEdit && (
                <button onClick={step.onEdit} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
                  Editar
                </button>
              )}
            </div>
            <p className={`mt-0.5 ${step.value ? "text-slate-800 dark:text-slate-100" : "text-slate-300 dark:text-slate-600"}`}>
              {step.value ?? "—"}
            </p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
