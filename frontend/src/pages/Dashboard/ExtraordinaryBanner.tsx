import { MiniMarkdown } from "../../components/MiniMarkdown";
import type { HorarioExtraordinario } from "../../api/types";

export function ExtraordinaryBanner({ horarios }: { horarios: HorarioExtraordinario[] }) {
  if (horarios.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-900/20">
      <h2 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">Horarios extraordinarios</h2>
      <div className="space-y-2 text-sm text-amber-900 dark:text-amber-200">
        {horarios.map((h) => (
          <div key={h.id}>
            <span className="font-medium">{h.biblioteca.nombre}</span> ·{" "}
            {new Date(h.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
            <MiniMarkdown texto={h.texto} />
          </div>
        ))}
      </div>
    </div>
  );
}
