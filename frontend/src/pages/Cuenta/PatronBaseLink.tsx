import { useState } from "react";
import { api } from "../../api/client";
import { nombreCuenta, useCuentas } from "../../auth/CuentaContext";
import { useAuth } from "../../auth/AuthContext";
import type { CuentaPatronBase } from "../../api/types";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";
const botonSecundario =
  "rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700";

const MODOS: { valor: CuentaPatronBase["modoReservas"]; label: string }[] = [
  { valor: "esta", label: "Solo las de esta cuenta" },
  { valor: "todas", label: "Las de todas mis cuentas" },
  { valor: "seleccionadas", label: "Las de esta y las cuentas que elija" },
];

function CuentaFila({ cuenta, soloUna, onCambio }: { cuenta: CuentaPatronBase; soloUna: boolean; onCambio: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alias, setAlias] = useState(cuenta.alias ?? "");

  async function ejecutar(accion: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await accion();
      await onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción");
    } finally {
      setBusy(false);
    }
  }

  const ok = cuenta.estadoVinculacion === "vinculada";
  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                ok
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              }`}
            >
              {ok ? "Vinculada" : "Error de acceso"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              {cuenta.principal ? "Principal" : "Secundaria"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{cuenta.patronbaseEmail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!ok && (
            <button
              disabled={busy}
              onClick={() => ejecutar(() => api.post(`/account/patronbase/cuentas/${cuenta.id}/retry`))}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "Comprobando…" : "Reintentar"}
            </button>
          )}
          {(!cuenta.principal || soloUna) && (
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm(`¿Quitar la cuenta ${cuenta.patronbaseEmail}? Se borrarán sus programaciones.`)) {
                  ejecutar(() => api.del(`/account/patronbase/cuentas/${cuenta.id}`));
                }
              }}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {cuenta.principal ? "Desvincular" : "Quitar"}
            </button>
          )}
        </div>
      </div>
      <form
        className="mt-2 flex max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ejecutar(() => api.patch(`/account/patronbase/cuentas/${cuenta.id}`, { alias: alias.trim() || null }));
        }}
      >
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          maxLength={40}
          placeholder="Alias (opcional)"
          className={`${inputClass} flex-1 py-1.5`}
        />
        <button disabled={busy || alias.trim() === (cuenta.alias ?? "")} className={botonSecundario}>
          Guardar alias
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

type Campo = "reservas" | "programaciones";

const CAMPOS: Record<Campo, { modo: "modoReservas" | "modoProgramaciones"; lista: "reservasDeCuentas" | "programacionesDeCuentas"; titulo: string; ayuda: string }> = {
  reservas: { modo: "modoReservas", lista: "reservasDeCuentas", titulo: "Reservas del dashboard", ayuda: "En curso y próximas." },
  programaciones: {
    modo: "modoProgramaciones",
    lista: "programacionesDeCuentas",
    titulo: "Programaciones",
    ayuda: "La lista de la pestaña Programaciones. Las nuevas se crean siempre en la cuenta activa.",
  },
};

function GrupoVisibilidad({
  campo,
  cuentaActiva,
  cuentas,
  onCambio,
}: {
  campo: Campo;
  cuentaActiva: CuentaPatronBase;
  cuentas: CuentaPatronBase[];
  onCambio: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const { modo, lista, titulo, ayuda } = CAMPOS[campo];

  async function guardar(datos: Record<string, unknown>) {
    setError(null);
    try {
      await api.patch(`/account/patronbase/cuentas/${cuentaActiva.id}`, datos);
      await onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el ajuste");
    }
  }

  const otras = cuentas.filter((c) => c.id !== cuentaActiva.id);
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">{titulo}</h3>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{ayuda}</p>
      <div className="space-y-1">
        {MODOS.map((m) => (
          <label key={m.valor} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="radio" name={`${campo}-${cuentaActiva.id}`} checked={cuentaActiva[modo] === m.valor} onChange={() => guardar({ [modo]: m.valor })} />
            {m.label}
          </label>
        ))}
      </div>
      {cuentaActiva[modo] === "seleccionadas" && (
        <div className="mt-2 space-y-1 pl-6">
          {otras.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={cuentaActiva[lista].includes(c.id)}
                onChange={(e) =>
                  guardar({
                    [lista]: e.target.checked ? [...cuentaActiva[lista], c.id] : cuentaActiva[lista].filter((x) => x !== c.id),
                  })
                }
              />
              {nombreCuenta(c)}
            </label>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** Qué se ve en el dashboard y en Programaciones cuando una cuenta concreta está activa. */
export function VisibilidadCuentas() {
  const { cuentas, cuentaActiva, recargar } = useCuentas();
  const { refresh } = useAuth();
  if (!cuentaActiva || cuentas.length < 2) return null;

  async function actualizar() {
    await recargar();
    await refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="font-medium text-slate-800 dark:text-slate-100">Qué se muestra</h2>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Ajuste de la cuenta activa: <span className="font-medium">{nombreCuenta(cuentaActiva)}</span>. Cada cuenta tiene el suyo; cambia de
        cuenta en el selector de arriba para ajustar otra.
      </p>
      <div className="space-y-5">
        <GrupoVisibilidad campo="reservas" cuentaActiva={cuentaActiva} cuentas={cuentas} onCambio={actualizar} />
        <GrupoVisibilidad campo="programaciones" cuentaActiva={cuentaActiva} cuentas={cuentas} onCambio={actualizar} />
      </div>
    </div>
  );
}

export function PatronBaseLink() {
  const { cuentas, cargada, recargar, seleccionar } = useCuentas();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [alias, setAlias] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  async function actualizar() {
    await recargar();
    await refresh();
  }

  async function anadir(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { cuentaId } = await api.post<{ cuentaId: string }>("/account/patronbase/cuentas", {
        email,
        password,
        ...(alias.trim() ? { alias: alias.trim() } : {}),
      });
      setEmail("");
      setPassword("");
      setAlias("");
      setMostrarFormulario(false);
      await actualizar();
      seleccionar(cuentaId);
    } catch (err) {
      // No limpiamos los campos: si el fallo fue puntual, basta con darle otra vez.
      setError(err instanceof Error ? err.message : "No se pudo añadir la cuenta");
    } finally {
      setBusy(false);
    }
  }

  if (!cargada) return null;
  const sinCuentas = cuentas.length === 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="font-medium text-slate-800 dark:text-slate-100">Mis cuentas de PatronBase</h2>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        Puedes usar varias cuentas de PatronBase desde el mismo acceso a BiblioBot y cambiar entre ellas con el selector de arriba.
      </p>

      {sinCuentas && (
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Sin una cuenta PatronBase vinculada no puedes crear reservas ni programaciones. La primera que añadas será la principal.
        </p>
      )}

      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {cuentas.map((c) => (
          <CuentaFila key={c.id} cuenta={c} soloUna={cuentas.length === 1} onCambio={actualizar} />
        ))}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
        {!sinCuentas && !mostrarFormulario ? (
          <button type="button" onClick={() => setMostrarFormulario(true)} className={botonSecundario}>
            + Vincular otra cuenta de PatronBase
          </button>
        ) : (
          <form onSubmit={anadir} className="grid max-w-md gap-3">
            <input
              type="email"
              placeholder="Email de PatronBase"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
            <input
              type="password"
              placeholder="Contraseña de PatronBase"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
            <input
              placeholder="Alias (opcional, p. ej. «Ana»)"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              maxLength={40}
              className={inputClass}
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? "Comprobando…" : sinCuentas ? "Vincular cuenta" : "Añadir cuenta"}
              </button>
              {!sinCuentas && (
                <button type="button" onClick={() => setMostrarFormulario(false)} className={botonSecundario}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
