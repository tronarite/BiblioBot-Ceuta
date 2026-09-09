import { MiniMarkdown } from "../../components/MiniMarkdown";
import type { HorarioExtraordinario } from "../../api/types";

export function ExtraordinaryBanner({ horarios }: { horarios: HorarioExtraordinario[] }) {
  if (horarios.length === 0) return null;
  return (
    // w-fit: el recuadro se ajusta al ancho del contenido en vez de estirarse a todo el
    // ancho del dashboard, dejando una franja vacía cuando el texto es corto.
    <div className="w-fit max-w-full rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-900/20 sm:max-w-xs">
      <h2 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">Horarios extraordinarios</h2>
      <div className="space-y-3 text-sm text-amber-900 dark:text-amber-200">
        {horarios.map((h) => (
          <MiniMarkdown key={h.id} texto={h.texto} />
        ))}
      </div>
    </div>
  );
}
