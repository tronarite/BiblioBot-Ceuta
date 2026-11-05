import type { DisponibilidadBiblioteca } from "../api/types";

const ESTILOS: Record<DisponibilidadBiblioteca["estado"], { label: string; classes: string }> = {
  disponible_hoy_manana: {
    label: "Disponible hoy y mañana",
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  disponible_solo_hoy: {
    label: "Disponible solo hoy",
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  disponible_solo_manana: {
    label: "Disponible solo mañana",
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  no_disponible: {
    label: "No disponible ni hoy ni mañana",
    classes: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
};

export function AvailabilityBadge({ disponibilidad }: { disponibilidad: DisponibilidadBiblioteca }) {
  const estilo = ESTILOS[disponibilidad.estado];
  return (
    // Fila a lo largo: nombre a la izquierda y estado a la derecha (baja a otra línea si no caben).
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-sm font-medium leading-snug text-slate-800 dark:text-slate-100 sm:text-base">{disponibilidad.nombre}</h3>
      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium sm:px-3 ${estilo.classes}`}>{estilo.label}</span>
      {disponibilidad.estado === "no_disponible" && disponibilidad.proximoDiaDisponibleTexto && (
        <p className="basis-full text-xs text-slate-500 dark:text-slate-400">{disponibilidad.proximoDiaDisponibleTexto}</p>
      )}
    </div>
  );
}
