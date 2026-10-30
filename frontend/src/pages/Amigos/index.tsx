import { useEffect, useState } from "react";
import { api } from "../../api/client";

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

function etiquetaTurno(t: ReservaAmigo["turnoTipo"]) {
  return t === "manana" ? "Mañana" : t === "tarde" ? "Tarde" : "";
}

function ReservasDeAmigo({ amigoId }: { amigoId: string }) {
  const [datos, setDatos] = useState<ReservasAmigo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ReservasAmigo>(`/friends/${amigoId}/reservas`)
      .then(setDatos)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar"));
  }, [amigoId]);

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!datos) return <p className="text-sm text-slate-400 dark:text-slate-500">Cargando…</p>;
  if (!datos.compartido) return <p className="text-sm text-slate-400 dark:text-slate-500">No comparte sus reservas.</p>;
  if (datos.reservas.length === 0) return <p className="text-sm text-slate-400 dark:text-slate-500">Sin reservas en curso ni próximas.</p>;
  return (
    <ul className="space-y-1.5">
      {datos.reservas.map((r) => (
        <li key={r.saleId} className="flex flex-wrap items-center gap-x-3 text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium">{r.bibliotecaNombre}</span>
          <span>{r.plantaNombre}</span>
          <span className="text-slate-500 dark:text-slate-400">
            {r.fecha} · {etiquetaTurno(r.turnoTipo)} {r.horario ?? ""}
          </span>
          {r.estado === "en_curso" && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              En curso
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AmigosPage() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

  function cargar() {
    api.get<Estado>("/friends").then(setEstado).catch((err) => setError(err instanceof Error ? err.message : "Error"));
  }
  useEffect(cargar, []);

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

      <div className={cardClass}>
        <h2 className="mb-3 font-medium text-slate-800 dark:text-slate-100">Mis amigos</h2>
        {estado.amigos.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Todavía no tienes amigos. Envía una solicitud con su email.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {estado.amigos.map((p) => (
              <li key={p.amistadId} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => setAbierto(abierto === p.id ? null : p.id)}
                    aria-expanded={abierto === p.id}
                    className="text-left text-sm font-medium text-slate-800 hover:underline dark:text-slate-100"
                  >
                    {p.nombre} <span className="text-xs font-normal text-slate-400">{abierto === p.id ? "▾" : "▸"}</span>
                  </button>
                  <button
                    onClick={() => accion(() => api.del(`/friends/${p.amistadId}`))}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Quitar
                  </button>
                </div>
                {abierto === p.id && (
                  <div className="mt-2">
                    <ReservasDeAmigo amigoId={p.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
