import { nombreCuenta, useCuentas } from "../auth/CuentaContext";

/**
 * Etiqueta con la cuenta PatronBase que realizará la acción de un asistente (reservar o
 * programar). Solo aparece si el usuario tiene más de una cuenta. Sin `cuentaId` es la activa.
 */
export function CuentaDelProceso({ cuentaId }: { cuentaId?: string }) {
  const { cuentas, cuentaActiva } = useCuentas();
  if (cuentas.length < 2) return null;
  const cuenta = (cuentaId ? cuentas.find((c) => c.id === cuentaId) : null) ?? cuentaActiva;
  if (!cuenta) return null;
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
      <span className="text-brand-500 dark:text-brand-400">Cuenta:</span>
      {nombreCuenta(cuenta)}
    </p>
  );
}
