import { useState } from "react";

/** Indicador de pasos de los asistentes (reserva y programación). */
export function IndicadorPasos({ pasos, paso }: { pasos: string[]; paso: number }) {
  return (
    <ol className="mb-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${pasos.length}, minmax(0, 1fr))` }} aria-label="Pasos">
      {pasos.map((nombre, i) => (
        <li key={nombre} aria-current={paso === i + 1 ? "step" : undefined}>
          <span className={`block h-1 rounded-full ${paso >= i + 1 ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"}`} />
          <span
            className={`mt-1 block text-xs ${
              paso === i + 1 ? "font-semibold text-brand-700 dark:text-brand-300" : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {i + 1}. {nombre}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Si el plano de la planta está desplegado; se recuerda en el navegador entre asistentes y visitas. */
export function usePlanoAbierto(): [boolean, () => void] {
  const [abierto, setAbierto] = useState(() => {
    try {
      return localStorage.getItem("bb.planoAbierto") !== "0";
    } catch {
      return true;
    }
  });
  function alternar() {
    setAbierto((v) => {
      try {
        localStorage.setItem("bb.planoAbierto", v ? "0" : "1");
      } catch {
        /* sin almacenamiento: el ajuste solo dura esta sesión */
      }
      return !v;
    });
  }
  return [abierto, alternar];
}

/** Plano de la planta con cabecera para minimizarlo. */
export function PlanoPlegable({
  src,
  planta,
  abierto,
  onAlternar,
  onAmpliar,
  className = "",
}: {
  src: string;
  planta: string;
  abierto: boolean;
  onAlternar: () => void;
  onAmpliar: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        <span>Plano de {planta}</span>
        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{abierto ? "Minimizar ▾" : "Mostrar ▸"}</span>
      </button>
      {abierto && (
        <button type="button" onClick={onAmpliar} className="mt-2 block w-full">
          <img src={src} alt={`Plano de ${planta}`} className="w-full cursor-zoom-in rounded-xl border border-slate-200 dark:border-slate-700" />
          <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">Toca la imagen para verla más grande</p>
        </button>
      )}
    </div>
  );
}

export const BTN =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-400 dark:border-slate-600 dark:text-slate-200";
export const PRIM =
  "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50";
