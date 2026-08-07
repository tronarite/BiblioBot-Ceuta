export type SummaryStep = {
  label: string;
  value: string | null;
  onEdit?: () => void;
};

export function SummarySidebar({ steps, onClose }: { steps: SummaryStep[]; onClose: () => void }) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white p-5">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Tu selección</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
          ✕
        </button>
      </div>
      <ol className="space-y-4">
        {steps.map((step, i) => (
          <li key={step.label} className="text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {i + 1}. {step.label}
              </span>
              {step.value && step.onEdit && (
                <button onClick={step.onEdit} className="text-xs text-brand-600 hover:underline">
                  Editar
                </button>
              )}
            </div>
            <p className={`mt-0.5 ${step.value ? "text-slate-800" : "text-slate-300"}`}>{step.value ?? "—"}</p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
