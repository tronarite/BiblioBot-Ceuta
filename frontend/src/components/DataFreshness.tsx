export type EstadoFrescura = "actualizando" | "actualizado" | "desactualizado";

function haceCuanto(iso: string | null, ahora: number): string {
  if (!iso) return "";
  const seg = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000));
  if (seg < 60) return "hace unos segundos";
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.round(min / 60)} h`;
}

/**
 * Indicador discreto del estado de los datos del dashboard (que primero muestra lo
 * último guardado y luego lo refresca en segundo plano): un punto de color con el
 * detalle en el tooltip, que se cambia por un botón de refrescar cuando están desactualizados.
 */
export function DataFreshness({
  estado,
  actualizadoEn,
  ahora,
  onRefrescar,
}: {
  estado: EstadoFrescura;
  actualizadoEn: string | null;
  ahora: number;
  onRefrescar: () => void;
}) {
  const hace = haceCuanto(actualizadoEn, ahora);
  const titulo =
    estado === "actualizando"
      ? "Buscando datos nuevos en PatronBase…"
      : estado === "actualizado"
        ? `Datos actualizados${hace ? ` (${hace})` : ""}`
        : `Datos desactualizados${hace ? ` (${hace})` : ""}`;

  // Solo el punto de color, sin recuadro; el detalle va en el tooltip. Cuando los datos
  // están desactualizados el punto se sustituye por un pequeño botón de refrescar, con
  // zona de 24x24 para que sea fácil de pulsar (el margen negativo compensa ese hueco
  // extra para que el icono quede igual de pegado al título que el punto).
  const zona = "flex shrink-0 items-center justify-center";

  if (estado === "desactualizado") {
    return (
      <button
        type="button"
        onClick={onRefrescar}
        title={`${titulo}. Pulsa para refrescar`}
        aria-label={`${titulo}. Refrescar`}
        className={`${zona} -ml-1 h-6 w-6 rounded-md text-amber-500 hover:bg-slate-200 hover:text-amber-600 dark:hover:bg-slate-700 dark:hover:text-amber-400`}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 10a6 6 0 1 1-1.76-4.24M16 4v3h-3" />
        </svg>
      </button>
    );
  }

  return (
    <span className={zona} title={titulo} role="status" aria-label={titulo} aria-live="polite">
      <span className="relative flex h-2.5 w-2.5">
        {estado === "actualizando" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${estado === "actualizando" ? "bg-brand-500" : "bg-emerald-500"}`}
        />
      </span>
    </span>
  );
}
