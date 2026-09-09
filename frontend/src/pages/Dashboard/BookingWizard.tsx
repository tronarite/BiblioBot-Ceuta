import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { parseSpanishDateLabel } from "../../api/dateEs";
import type { Biblioteca, ConCache, EstadoTurno, PerformanceOption, PerformancesResponse, Planta, SeatInfo, Turno } from "../../api/types";
import { formatearAsiento, parseAsiento } from "../../api/seatLabel";
import { FullScreenPanel } from "../../components/FullScreenPanel";
import { ImageLightbox } from "../../components/ImageLightbox";
import { SeatMapViewer } from "../../components/SeatMapViewer";
import type { SummaryStep } from "../../components/SummarySidebar";

type Fase = "elegir" | "dia" | "asiento" | "cesta";

type ItemCesta = {
  turno: Turno;
  planta: Planta;
  biblioteca: Biblioteca;
  perf: PerformanceOption;
  seat: SeatInfo;
};

const PLANO_POR_PLANTA: Record<string, string> = {
  "3ª Planta": "/Planta3.jpg",
  "4ª Planta": "/Planta4.jpg",
  "5ª Planta": "/Planta5.jpg",
};

function tipoLabel(t: Turno["tipo"]) {
  return t === "manana" ? "Mañana" : "Tarde";
}

export function BookingWizard({
  bibliotecas,
  onClose,
  onCreated,
}: {
  bibliotecas: Biblioteca[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fase, setFase] = useState<Fase>("elegir");
  const [turnoActual, setTurnoActual] = useState<Turno | null>(null);
  const [performances, setPerformances] = useState<PerformanceOption[]>([]);
  const [perf, setPerf] = useState<PerformanceOption | null>(null);
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [seat, setSeat] = useState<SeatInfo | null>(null);
  const [cesta, setCesta] = useState<ItemCesta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estadoTurnos, setEstadoTurnos] = useState<EstadoTurno[] | null>(null);
  const [planoAmpliado, setPlanoAmpliado] = useState(false);

  function plantaDe(t: Turno): Planta | null {
    return bibliotecas.flatMap((b) => b.plantas).find((p) => p.turnos.some((x) => x.id === t.id)) ?? null;
  }
  function bibliotecaDe(t: Turno): Biblioteca | null {
    return bibliotecas.find((b) => b.plantas.some((p) => p.turnos.some((x) => x.id === t.id))) ?? null;
  }

  const plantaActual = turnoActual ? plantaDe(turnoActual) : null;
  const bibliotecaActual = turnoActual ? bibliotecaDe(turnoActual) : null;
  const plano = plantaActual ? PLANO_POR_PLANTA[plantaActual.nombre] : undefined;

  useEffect(() => {
    api
      .get<ConCache<EstadoTurno[]>>("/libraries/turnos-estado")
      .then((res) => {
        setEstadoTurnos(res.items);
        if (res.actualizando) {
          // Los datos venían de caché y el servidor los está refrescando en segundo
          // plano; se consulta una vez más al cabo de unos segundos para reflejar el
          // cambio (p. ej. el aviso de "pocas plazas") sin recargar la página.
          setTimeout(() => {
            api
              .get<ConCache<EstadoTurno[]>>("/libraries/turnos-estado")
              .then((r) => setEstadoTurnos(r.items))
              .catch(() => {});
          }, 4000);
        }
      })
      .catch(() => setEstadoTurnos([]));
  }, []);

  useEffect(() => {
    if (fase !== "dia" || !turnoActual) return;
    setLoading(true);
    setError(null);
    api
      .get<PerformancesResponse>(`/reservations/performances?turnoId=${turnoActual.id}`)
      .then((res) => setPerformances(res.options))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fase, turnoActual]);

  useEffect(() => {
    if (fase !== "asiento" || !turnoActual || !perf) return;
    setLoading(true);
    setError(null);
    api
      .get<{ seats: SeatInfo[] }>(`/reservations/seatmap?turnoId=${turnoActual.id}&perfId=${perf.perfId}`)
      .then((res) => setSeats(res.seats))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fase, turnoActual, perf]);

  function elegirTurno(t: Turno) {
    setTurnoActual(t);
    setPerf(null);
    setSeat(null);
    setPerformances([]);
    setSeats([]);
    setError(null);
    setFase("dia");
  }

  function volverAElegir() {
    setFase("elegir");
    setTurnoActual(null);
    setPerf(null);
    setSeat(null);
    setError(null);
  }

  function volverADia() {
    setFase("dia");
    setSeat(null);
    setSeats([]);
    setError(null);
  }

  function quitarDeCesta(i: number) {
    setCesta((prev) => prev.filter((_, idx) => idx !== i));
  }

  function añadirACesta() {
    if (!turnoActual || !plantaActual || !bibliotecaActual || !perf || !seat) return;
    const nuevo: ItemCesta = { turno: turnoActual, planta: plantaActual, biblioteca: bibliotecaActual, perf, seat };
    setCesta((prev) => [...prev, nuevo]);
    setTurnoActual(null);
    setPerf(null);
    setSeat(null);
    setPerformances([]);
    setSeats([]);
    setFase("elegir");
  }

  async function confirmarCesta() {
    setLoading(true);
    setError(null);
    const fallidos: string[] = [];
    const exitosos: ItemCesta[] = [];
    for (const c of cesta) {
      try {
        const fecha = parseSpanishDateLabel(c.perf.label) ?? new Date();
        await api.post("/reservations", {
          turnoId: c.turno.id,
          perfId: c.perf.perfId,
          fecha: fecha.toISOString(),
          seat: {
            sectionId: c.seat.sectionId,
            areaId: c.seat.areaId,
            rowId: c.seat.rowId,
            seatId: c.seat.seatId,
            seatTypeId: c.seat.seatTypeId,
            label: c.seat.label,
          },
        });
        exitosos.push(c);
      } catch (err) {
        fallidos.push(
          `${c.planta.nombre} · ${tipoLabel(c.turno.tipo)}: ${err instanceof Error ? err.message : "error desconocido"}`,
        );
      }
    }
    setLoading(false);
    if (fallidos.length > 0) {
      setCesta((prev) => prev.filter((c) => !exitosos.includes(c)));
      setError(`Alguna reserva no se pudo completar:\n${fallidos.join("\n")}`);
      if (exitosos.length > 0) onCreated();
      return;
    }
    onCreated();
  }

  const steps: SummaryStep[] = cesta.map((c) => ({
    label: `${c.biblioteca.nombre} · ${c.planta.nombre} · ${tipoLabel(c.turno.tipo)}`,
    value: `${c.perf.label.split("No estará")[0]} · ${formatearAsiento(c.seat.label)}`,
    onEdit: () => setFase("cesta"),
  }));

  return (
    <FullScreenPanel title="Hacer una reserva" onClose={onClose} steps={steps}>
      {error && (
        <p className="mb-4 whitespace-pre-line rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      {fase === "elegir" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Elige un turno, su día y el asiento: se añadirá a tu cesta. Puedes repetir el proceso para añadir varios
              turnos (por ejemplo, mañana y tarde) antes de confirmarlos todos juntos.
            </p>
            <button
              type="button"
              onClick={() => setFase("cesta")}
              disabled={cesta.length === 0}
              className="shrink-0 rounded-lg border border-brand-500 px-3 py-2 text-sm font-medium text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-brand-400"
            >
              Cesta ({cesta.length})
            </button>
          </div>
          {bibliotecas.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Has ocultado todas las bibliotecas desde Cuenta. Vuelve a marcar alguna ahí para poder reservar.
            </p>
          )}
          {bibliotecas.map((b) => (
            <div key={b.id}>
              <h3 className="mb-2 font-medium text-slate-700 dark:text-slate-200">{b.nombre}</h3>
              <div className="space-y-4">
                {(["manana", "tarde"] as const).map((tipo) => {
                  const turnosDeTipo = b.plantas.flatMap((p) => p.turnos.filter((t) => t.tipo === tipo).map((t) => ({ turno: t, planta: p })));
                  if (turnosDeTipo.length === 0) return null;
                  return (
                    <div key={tipo}>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {tipoLabel(tipo)}
                      </h4>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {turnosDeTipo.map(({ turno: t, planta: p }) => {
                          const estado = estadoTurnos?.find((e) => e.turnoId === t.id);
                          const deshabilitado = estado ? !estado.disponibleAhora : false;
                          const enCesta = cesta.filter((c) => c.turno.id === t.id).length;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              disabled={deshabilitado}
                              title={deshabilitado ? (estado?.mensaje ?? undefined) : undefined}
                              onClick={() => elegirTurno(t)}
                              className={`rounded-xl border p-3 text-left text-sm transition ${
                                deshabilitado
                                  ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500"
                                  : `hover:border-brand-400 dark:border-slate-700 dark:hover:border-brand-500 ${
                                      enCesta > 0 ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30" : "border-slate-200 dark:bg-slate-800"
                                    }`
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium dark:text-slate-100">{p.nombre}</p>
                                {enCesta > 0 && (
                                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
                                    En la cesta{enCesta > 1 ? ` ×${enCesta}` : ""}
                                  </span>
                                )}
                              </div>
                              {deshabilitado ? (
                                <p className="mt-1 text-xs">{estado?.mensaje ?? "No disponible por ahora"}</p>
                              ) : (
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.horario}</p>
                              )}
                              {!deshabilitado && estado?.pocasPlazasHoy && (
                                <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                  Quedan pocas plazas hoy ({estado.plazasLibresHoy})
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {fase === "dia" && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button type="button" onClick={volverAElegir} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
              ← Volver a elegir turnos
            </button>
            {cesta.length > 0 && (
              <button type="button" onClick={() => setFase("cesta")} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
                Ver cesta ({cesta.length})
              </button>
            )}
          </div>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            {bibliotecaActual?.nombre} · {plantaActual?.nombre} · {turnoActual ? tipoLabel(turnoActual.tipo) : ""}
          </p>
          {loading && <p className="text-sm text-slate-500 dark:text-slate-400">Consultando días disponibles…</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {performances.map((p) => (
              <button
                key={p.perfId}
                disabled={!p.available}
                onClick={() => {
                  setPerf(p);
                  setSeat(null);
                  setFase("asiento");
                }}
                className={`rounded-xl border p-3 text-left text-sm transition ${
                  p.available
                    ? "border-slate-200 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-brand-500"
                    : "cursor-not-allowed border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-600"
                }`}
              >
                <p className="font-medium">{p.label.split("No estará")[0]}</p>
                {!p.available && p.availableFromText && <p className="mt-1 text-xs">{p.availableFromText}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {fase === "asiento" && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button type="button" onClick={volverADia} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
              ← Cambiar día
            </button>
            <button type="button" onClick={volverAElegir} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
              ← Volver a elegir turnos
            </button>
            {cesta.length > 0 && (
              <button type="button" onClick={() => setFase("cesta")} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
                Ver cesta ({cesta.length})
              </button>
            )}
          </div>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            {bibliotecaActual?.nombre} · {plantaActual?.nombre} · {turnoActual ? tipoLabel(turnoActual.tipo) : ""} ·{" "}
            {perf?.label.split("No estará")[0]}
          </p>
          <div className={plano ? "grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]" : undefined}>
            {plano && (
              <div>
                <button type="button" onClick={() => setPlanoAmpliado(true)} className="block w-full">
                  <img
                    src={plano}
                    alt={`Plano de ${plantaActual?.nombre}`}
                    className="w-full cursor-zoom-in rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                  <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">Toca la imagen para verla más grande</p>
                </button>
              </div>
            )}
            <div>
              {loading && <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Cargando mapa de asientos…</p>}
              <SeatMapViewer seats={seats} mode="single" selected={seat} onSelect={(s) => setSeat(s)} />
              {seat && (
                <button
                  onClick={añadirACesta}
                  className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Añadir a la cesta
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {planoAmpliado && plano && (
        <ImageLightbox src={plano} alt={`Plano de ${plantaActual?.nombre}`} onClose={() => setPlanoAmpliado(false)} />
      )}

      {fase === "cesta" && (
        <div className="max-w-md space-y-4">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">Tu cesta</h2>
          {cesta.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Todavía no has añadido ningún turno.</p>
          ) : (
            <div className="space-y-3">
              {cesta.map((c, i) => {
                const asiento = parseAsiento(c.seat.label);
                return (
                  <div
                    key={`${c.turno.id}-${i}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <div>
                      <p className="font-medium">
                        {c.biblioteca.nombre} · {c.planta.nombre} · {tipoLabel(c.turno.tipo)}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">{c.perf.label.split("No estará")[0]}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {asiento ? (
                          <>
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              {asiento.tipo}
                            </span>
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              Asiento {asiento.numero}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">{c.seat.label}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => quitarDeCesta(i)}
                      className="shrink-0 text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Quitar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setFase("elegir")}
              className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:border-brand-400 dark:border-slate-600 dark:text-slate-200"
            >
              ← Seguir eligiendo
            </button>
            <button
              onClick={confirmarCesta}
              disabled={loading || cesta.length === 0}
              className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "Confirmando…" : `Confirmar ${cesta.length} reserva${cesta.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
    </FullScreenPanel>
  );
}
