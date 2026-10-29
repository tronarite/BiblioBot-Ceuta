import { nombreCuenta, useCuentas } from "../auth/CuentaContext";

/**
 * Selector de cuenta PatronBase activa y botón para ver, por un momento, las reservas y
 * programaciones de todas las cuentas juntas. Solo aparece si hay más de una cuenta.
 */
export function CuentaSelector() {
  const { cuentas, cuentaActivaId, vistaTodas, alternarTodas, seleccionar } = useCuentas();
  if (cuentas.length < 2) return null;

  return (
    <div className="flex items-center gap-1.5">
      <select
        aria-label="Cuenta activa"
        value={cuentaActivaId ?? ""}
        onChange={(e) => seleccionar(e.target.value)}
        className="max-w-[10rem] truncate rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
      >
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>
            {nombreCuenta(c)}
            {c.principal ? " ★" : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={alternarTodas}
        aria-pressed={vistaTodas}
        title={vistaTodas ? "Volver a la vista de tu cuenta" : "Ver reservas y programaciones de todas las cuentas"}
        className={`whitespace-nowrap rounded-lg border px-2 py-1.5 text-sm font-medium transition ${
          vistaTodas
            ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/40 dark:text-brand-300"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        }`}
      >
        Ver todas
      </button>
    </div>
  );
}
