/**
 * Confirmación a pantalla completa con un tick verde que se dibuja: se muestra un instante
 * al completar una acción (p. ej. una reserva) antes de volver al dashboard. Las
 * animaciones viven en styles/index.css (bb-success-*) y se desactivan solas si el usuario
 * pide menos movimiento.
 */
export function SuccessOverlay({ mensaje = "Reserva realizada correctamente" }: { mensaje?: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="bb-success-pop flex flex-col items-center gap-4 rounded-2xl bg-white px-10 py-9 text-center shadow-xl dark:bg-slate-800">
        <svg viewBox="0 0 60 60" className="h-20 w-20" aria-hidden="true">
          <circle
            cx="30"
            cy="30"
            r="26"
            fill="none"
            stroke="#22c55e"
            strokeWidth="4"
            strokeLinecap="round"
            className="bb-success-circle"
          />
          <path
            d="M18 31 l8 8 l16 -18"
            fill="none"
            stroke="#22c55e"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="bb-success-check"
          />
        </svg>
        <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{mensaje}</p>
      </div>
    </div>
  );
}
