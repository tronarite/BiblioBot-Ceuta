import { nombreCuenta, useCuentas } from "../auth/CuentaContext";

const VISTA_TODAS = "todas";

/**
 * Selector de cuenta PatronBase activa. Incluye la opción «Todas las cuentas», una vista
 * de solo lectura. La elección se recuerda al recargar. Solo aparece si hay más de una cuenta.
 */
export function CuentaSelector() {
  const { cuentas, cuentaActivaId, vistaTodas, alternarTodas, seleccionar } = useCuentas();
  if (cuentas.length < 2) return null;

  function cambiar(valor: string) {
    if (valor === VISTA_TODAS) {
      if (!vistaTodas) alternarTodas();
    } else {
      seleccionar(valor);
    }
  }

  return (
    <select
      aria-label="Cuenta activa"
      value={vistaTodas ? VISTA_TODAS : (cuentaActivaId ?? "")}
      onChange={(e) => cambiar(e.target.value)}
      className="max-w-[10rem] truncate rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
    >
      {cuentas.map((c) => (
        <option key={c.id} value={c.id}>
          {nombreCuenta(c)}
          {c.principal ? " ★" : ""}
        </option>
      ))}
      <option value={VISTA_TODAS}>Todas las cuentas</option>
    </select>
  );
}
