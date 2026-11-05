import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { parseAsiento } from "../../api/seatLabel";

type Persona = { amistadId: string; id: string; nombre: string; email: string | null };
type Privacidad = {
  compartirReservas: boolean;
  compartirPlanta: boolean;
  compartirTurno: boolean;
  compartirAsiento: boolean;
};
type Estado = { amigos: Persona[]; recibidas: Persona[]; enviadas: Persona[]; privacidad: Privacidad };
// Los campos opcionales llegan a null si el amigo ha decidido no compartirlos.
type ReservaAmigo = {
  saleId: string;
  bibliotecaNombre: string;
  plantaNombre: string | null;
  turnoTipo: "manana" | "tarde" | null;
  asiento: string | null;
  fecha: string;
  estado: "en_curso" | "proxima";
};
type ReservasAmigo = { compartido: boolean; reservas: ReservaAmigo[] };
type Turno = ReservaAmigo & { amigoId: string; amigoNombre: string };

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";
const cardClass = "rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800";
const btnSec =
  "rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700";

// Mismos colores de turno que las tarjetas de "Mis reservas" (Dashboard/ReservationsList).
const TURNO_ESTILO: Record<"manana" | "tarde", { label: string; classes: string }> = {
  manana: { label: "Mañana", classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  tarde: { label: "Tarde", classes: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
};

/** Tarjeta de un turno de un amigo, con la misma estructura que ReservaCard. */
function TurnoCard({ t }: { t: Turno }) {
  const turno = t.turnoTipo ? TURNO_ESTILO[t.turnoTipo] : null;
  const asiento = t.asiento ? parseAsiento(t.asiento) : null;
  const chip = "inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-700/60";
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div
        className={`flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 text-xs font-semibold uppercase tracking-wide ${
          turno ? turno.classes : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
        }`}
      >
        <span>{turno ? turno.label : "—"}</span>
      </div>

      <div className="min-w-0 flex-1 p-4">
        {/* El amigo es lo prioritario: va como título de la tarjeta. */}
        <p className="mb-1.5 truncate text-xl font-bold leading-tight text-slate-900 dark:text-slate-50">{t.amigoNombre}</p>
        <p className="text-base font-semibold leading-tight text-slate-800 dark:text-slate-100">{t.bibliotecaNombre}</p>
        {t.plantaNombre && <p className="text-sm text-slate-500 dark:text-slate-400">{t.plantaNombre}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium capitalize">
            {new Date(t.fecha).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>

        {t.asiento && (
          <div className="mt-3 flex flex-wrap gap-2">
            {asiento ? (
              <>
                <div className={chip}>
                  <span className="text-slate-400 dark:text-slate-500">Tipo</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{asiento.tipo}</span>
                </div>
                <div className={chip}>
                  <span className="text-slate-400 dark:text-slate-500">Asiento</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{asiento.numero}</span>
                </div>
              </>
            ) : (
              <div className={chip}>
                <span className="text-slate-400 dark:text-slate-500">Asiento</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{t.asiento}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ListaTurnos({ titulo, turnos, vacio }: { titulo: string; turnos: Turno[]; vacio: string }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</h2>
      {turnos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
          {vacio}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
          {turnos.map((t) => (
            <TurnoCard key={t.amigoId + t.saleId + t.fecha} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TurnosAmigos({ amigos, reservas }: { amigos: Persona[]; reservas: Record<string, ReservasAmigo | "error"> }) {
  if (amigos.length === 0) return null;
  if (Object.keys(reservas).length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Cargando turnos de tus amigos…</p>;
  }

  const turnos: Turno[] = [];
  for (const a of amigos) {
    const r = reservas[a.id];
    if (r && r !== "error" && r.compartido)
      for (const x of r.reservas) turnos.push({ ...x, amigoId: a.id, amigoNombre: a.nombre });
  }
  const porFecha = (x: Turno, y: Turno) =>
    x.fecha.localeCompare(y.fecha) ||
    (x.turnoTipo ?? "").localeCompare(y.turnoTipo ?? "") ||
    x.amigoNombre.localeCompare(y.amigoNombre);
  const enCurso = turnos.filter((t) => t.estado === "en_curso").sort(porFecha);
  const proximas = turnos.filter((t) => t.estado === "proxima").sort(porFecha);

  const sinCompartir = amigos.filter((a) => {
    const r = reservas[a.id];
    return r && r !== "error" && !r.compartido;
  });
  const conError = amigos.filter((a) => reservas[a.id] === "error");

  return (
    <div className="space-y-6">
      <ListaTurnos titulo="En curso" turnos={enCurso} vacio="Ningún amigo tiene turnos en curso" />
      <ListaTurnos titulo="Próximas" turnos={proximas} vacio="Ningún amigo tiene próximas reservas" />
      {sinCompartir.length > 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          No comparten sus reservas: {sinCompartir.map((a) => a.nombre).join(", ")}.
        </p>
      )}
      {conError.length > 0 && (
        <p className="text-sm text-red-600 dark:text-red-400">
          No se pudieron cargar los turnos de: {conError.map((a) => a.nombre).join(", ")}.
        </p>
      )}
    </div>
  );
}

const CAMPOS_OPCIONALES: { clave: keyof Privacidad; label: string }[] = [
  { clave: "compartirPlanta", label: "Planta" },
  { clave: "compartirTurno", label: "Turno (mañana o tarde)" },
  { clave: "compartirAsiento", label: "Asiento (tipo y número)" },
];

function QueVenMisAmigos({ privacidad, cambiar }: { privacidad: Privacidad; cambiar: (c: Partial<Privacidad>) => void }) {
  const activo = privacidad.compartirReservas;
  return (
    <div className={cardClass}>
      <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Qué ven mis amigos</h2>
      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => cambiar({ compartirReservas: e.target.checked })}
          className="mt-0.5"
        />
        <span className="font-medium">Que mis amigos vean mis reservas</span>
      </label>
      <div className={`mt-3 space-y-2 border-l-2 border-slate-100 pl-4 dark:border-slate-700 ${activo ? "" : "opacity-50"}`}>
        <p className="text-sm text-slate-500 dark:text-slate-400">Siempre: biblioteca y día.</p>
        {CAMPOS_OPCIONALES.map((c) => (
          <label key={c.clave} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={privacidad[c.clave]}
              disabled={!activo}
              onChange={(e) => cambiar({ [c.clave]: e.target.checked })}
            />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function AmigosPage() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [reservas, setReservas] = useState<Record<string, ReservasAmigo | "error">>({});

  function cargar() {
    api.get<Estado>("/friends").then(setEstado).catch((err) => setError(err instanceof Error ? err.message : "Error"));
  }
  useEffect(cargar, []);

  // Turnos de todos los amigos de golpe (se vuelven a pedir si cambia la lista de amigos).
  const idsAmigos = estado?.amigos.map((a) => a.id).join(",") ?? "";
  useEffect(() => {
    if (!idsAmigos) {
      setReservas({});
      return;
    }
    let vivo = true;
    for (const id of idsAmigos.split(",")) {
      api
        .get<ReservasAmigo>(`/friends/${id}/reservas`)
        .then((r) => vivo && setReservas((prev) => ({ ...prev, [id]: r })))
        .catch(() => vivo && setReservas((prev) => ({ ...prev, [id]: "error" })));
    }
    return () => {
      vivo = false;
    };
  }, [idsAmigos]);

  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    setAviso(null);
    try {
      await fn();
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function enviarSolicitud(e: React.FormEvent) {
    e.preventDefault();
    await accion(async () => {
      const r = await api.post<{ aceptada: boolean }>("/friends/solicitud", { email });
      setEmail("");
      setAviso(r.aceptada ? "Ya sois amigos." : "Solicitud enviada.");
    });
  }

  if (!estado) return <p className="text-sm text-slate-400 dark:text-slate-500">Cargando…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Amigos</h1>

      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
      {aviso && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{aviso}</p>}

      {(estado.recibidas.length > 0 || estado.enviadas.length > 0) && (
        <div className={cardClass}>
          <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Solicitudes</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {estado.recibidas.map((p) => (
              <li key={p.amistadId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-200">
                  <b>{p.nombre}</b> quiere ser tu amigo
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => accion(() => api.post(`/friends/${p.amistadId}/aceptar`))}
                    className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    Aceptar
                  </button>
                  <button onClick={() => accion(() => api.del(`/friends/${p.amistadId}`))} className={btnSec}>
                    Rechazar
                  </button>
                </span>
              </li>
            ))}
            {estado.enviadas.map((p) => (
              <li key={p.amistadId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  Esperando a que <b>{p.nombre}</b> acepte
                </span>
                <button onClick={() => accion(() => api.del(`/friends/${p.amistadId}`))} className={btnSec}>
                  Cancelar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <TurnosAmigos amigos={estado.amigos} reservas={reservas} />

      <div className={cardClass}>
        <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Mis amigos</h2>
        {estado.amigos.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Todavía no tienes amigos. Envía una solicitud con su email.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {estado.amigos.map((p) => (
              <li key={p.amistadId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{p.nombre}</span>
                <button
                  onClick={() => accion(() => api.del(`/friends/${p.amistadId}`))}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cardClass}>
        <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Agregar un amigo</h2>
        <form onSubmit={enviarSolicitud} className="flex max-w-lg flex-wrap gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email con el que usa BiblioBot"
            required
            className={`min-w-0 flex-1 ${inputClass}`}
          />
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Enviar solicitud</button>
        </form>
      </div>

      <QueVenMisAmigos privacidad={estado.privacidad} cambiar={(cambio) => accion(() => api.patch("/friends/privacidad", cambio))} />

    </div>
  );
}
