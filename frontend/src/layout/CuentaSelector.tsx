import { nombreCuenta, useCuentas } from "../auth/CuentaContext";

/** Selector de cuenta PatronBase activa; solo aparece si hay más de una. */
export function CuentaSelector() {
  const { cuentas, cuentaActivaId, seleccionar } = useCuentas();
  if (cuentas.length < 2) return null;

  return (
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
  );
}
