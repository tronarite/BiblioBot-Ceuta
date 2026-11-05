import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { parseSpanishDateLabel } from "../../api/dateEs";

type Persona = { amistadId: string; id: string; nombre: string; email: string | null };
type Estado = { amigos: Persona[]; recibidas: Persona[]; enviadas: Persona[]; compartirReservas: boolean };
type ReservaAmigo = {
  saleId: string;
  bibliotecaNombre: string;
  plantaNombre: string;
  turnoTipo: "manana" | "tarde" | null;
  horario: string | null;
  fecha: string;
  estado: "en_curso" | "proxima";
};
type ReservasAmigo = { compartido: boolean; reservas: ReservaAmigo[] };

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";
const cardClass = "rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800";
const btnSec =
  "rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700";

const AVATAR_COLORES = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-emerald-600",
  "bg-teal-600",
  "bg-sky-600",
  "bg-indigo-500",
  "bg-fuchsia-600",
  "bg-pink-600",
];

function colorAvatar(nombre: string) {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORES[h % AVATAR_COLORES.length];
}

function Avatar({ nombre, size = "h-10 w-10 text-base" }: { nombre: string; size?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${size} ${colorAvatar(nombre)}`}
    >
      {nombre.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function estiloTurno(t: ReservaAmigo["turnoTipo"]) {
  if (t === "manana")
    return {
      etiqueta: "Mañana",
      icono: "☀️",
      caja: "border-amber-300 bg-amber-50 dark:border-amber-700/70 dark:bg-amber-900/20",
      texto: "text-amber-800 dark:text-amber-200",
    };
  if (t === "tarde")
    return {
      etiqueta: "Tarde",
      icono: "🌙",
      caja: "border-indigo-300 bg-indigo-50 dark:border-indigo-700/70 dark:bg-indigo-900/20",
      texto: "text-indigo-800 dark:text-indigo-200",
    };
  return {
    etiqueta: "Turno",
    icono: "📚",
    caja: "border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/40",
    texto: "text-slate-700 dark:text-slate-200",
  };
}

const MS_DIA = 24 * 60 * 60 * 1000;

function etiquetaDia(fecha: string): { titulo: string; sub: string; orden: number } {
  const d = parseSpanishDateLabel(fecha);
  if (!d) return { titulo: fecha, sub: "", orden: Number.MAX_SAFE_INTEGER };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - hoy.getTime()) / MS_DIA);
  const larga = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  if (diff === 0) return { titulo: "Hoy", sub: larga, orden: d.getTime() };
  if (diff === 1) return { titulo: "Mañana", sub: larga, orden: d.getTime() };
  return { titulo: larga.charAt(0).toUpperCase() + larga.slice(1), sub: "", orden: d.getTime() };
}

type Turno = ReservaAmigo & { amigoId: string; amigoNombre: string };

function TarjetaTurno({ t }: { t: Turno }) {
  const e = estiloTurno(t.turnoTipo);
  return (
    <li className={`flex items-center gap-3 rounded-2xl border-2 p-3.5 ${e.caja}`}>
      <Avatar nombre={t.amigoNombre} size="h-12 w-12 text-lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">{t.amigoNombre}</span>
          {t.estado === "en_curso" && (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">En curso</span>
          )}
        </div>
        <p className={`text-lg font-bold leading-tight ${e.texto}`}>
          {e.icono} {e.etiqueta}
          {t.horario ? <span className="ml-2 text-base font-semibold">{t.horario}</span> : null}
        </p>
        <p className="truncate text-sm text-slate-600 dark:text-slate-300">
          {t.bibliotecaNombre} · {t.plantaNombre}
        </p>
      </div>
    </li>
  );
}

function AgendaAmigos({ amigos, reservas }: { amigos: Persona[]; reservas: Record<string, ReservasAmigo | "error"> }) {
  const cargando = amigos.some((a) => reservas[a.id] === undefined);
  const turnos: Turno[] = [];
  for (const a of amigos) {
    const r = reservas[a.id];
    if (r && r !== "error" && r.compartido)
      for (const x of r.reservas) turnos.push({ ...x, amigoId: a.id, amigoNombre: a.nombre });
  }
  const grupos = new Map<string, { titulo: string; sub: string; orden: number; items: Turno[] }>();
  for (const t of turnos) {
    const g = grupos.get(t.fecha) ?? { ...etiquetaDia(t.fecha), items: [] };
    g.items.push(t);
    grupos.set(t.fecha, g);
  }
  const dias = [...grupos.values()].sort((x, y) => x.orden - y.orden);
  const ordenTurno = (t: Turno) => (t.turnoTipo === "manana" ? 0 : t.turnoTipo === "tarde" ? 1 : 2);

  const sinCompartir = amigos.filter((a) => {
    const r = reservas[a.id];
    return r && r !== "error" && !r.compartido;
  });
  const conError = amigos.filter((a) => reservas[a.id] === "error");

  if (amigos.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Cuando tengas amigos verás aquí sus turnos.</p>;
  }

  return (
    <div className="space-y-4">
      {cargando && dias.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">Cargando turnos…</p>}
      {!cargando && dias.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
          Ningún amigo tiene turnos en curso ni próximos.
        </p>
      )}
      {dias.map((d) => (
        <section key={d.titulo + d.orden}>
          <h3 className="mb-2 flex flex-wrap items-baseline gap-x-2">
            <span className="text-lg font-bold text-slate-900 dark:text-slate-50">{d.titulo}</span>
            {d.sub && <span className="text-sm capitalize text-slate-500 dark:text-slate-400">{d.sub}</span>}
          </h3>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {[...d.items]
              .sort((x, y) => ordenTurno(x) - ordenTurno(y) || x.amigoNombre.localeCompare(y.amigoNombre))
              .map((t) => (
                <TarjetaTurno key={t.saleId + t.amigoId} t={t} />
              ))}
          </ul>
        </section>
      ))}
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

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">Turnos de mis amigos</h2>
        <AgendaAmigos amigos={estado.amigos} reservas={reservas} />
      </section>

      <div className={cardClass}>
        <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Mis amigos ({estado.amigos.length})</h2>
        {estado.amigos.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Todavía no tienes amigos. Envía una solicitud con su email.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {estado.amigos.map((p) => (
              <li key={p.amistadId} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar nombre={p.nombre} />
                  <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{p.nombre}</span>
                </span>
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
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={estado.compartirReservas}
            onChange={(e) => accion(() => api.patch("/friends/privacidad", { compartirReservas: e.target.checked }))}
            className="mt-0.5"
          />
          <span>
            Que mis amigos vean mis reservas (biblioteca, planta, turno y día). Nunca se muestra el asiento.
          </span>
        </label>
      </div>
    </div>
  );
}
