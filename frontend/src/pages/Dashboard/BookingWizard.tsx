import { Fragment, useEffect, useState } from "react";
import { api } from "../../api/client";
import { parseSpanishDateLabel } from "../../api/dateEs";
import type { Biblioteca, ConCache, EstadoTurno, PerformanceOption, PerformancesResponse, Planta, SeatInfo, Turno } from "../../api/types";
import { formatearAsiento, parseAsiento } from "../../api/seatLabel";
import { FullScreenPanel } from "../../components/FullScreenPanel";
import { ImageLightbox } from "../../components/ImageLightbox";
import { SeatMapViewer } from "../../components/SeatMapViewer";
import { SuccessOverlay } from "../../components/SuccessOverlay";
import type { SummaryStep } from "../../components/SummarySidebar";

type Fase = "elegir" | "dia" | "cesta";

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

const PASOS = ["Turno", "Día y asiento", "Confirmar"];

function IndicadorPasos({ paso }: { paso: 1 | 2 | 3 }) {
  return (
    <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="Pasos de la reserva">
      {PASOS.map((nombre, i) => (
        <li key={nombre} aria-current={paso === i + 1 ? "step" : undefined}>
          <span className={`block h-1 rounded-full ${paso >= i + 1 ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"}`} />
          <span
            className={`mt-1 block text-xs ${
              paso === i + 1 ? "font-semibold text-brand-700 dark:text-brand-300" : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {i + 1}. {nombre}
          </span>
        </li>
      ))}
    </ol>
  );
}

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
  const [exito, setExito] = useState(false);

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
    if (fase !== "dia" || !turnoActual || !perf) return;
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
    // Reserva(s) completadas sin fallos: se muestra el tick de confirmación un instante
    // antes de cerrar el asistente y refrescar el dashboard.
    setExito(true);
    setTimeout(onCreated, 1800);
  }

  const steps: SummaryStep[] = cesta.map((c) => ({
    label: `${c.biblioteca.nombre} · ${c.planta.nombre} · ${tipoLabel(c.turno.tipo)}`,
    value: `${c.perf.label.split("No estará")[0]} · ${formatearAsiento(c.seat.label)}`,
    onEdit: () => setFase("cesta"),
  }));

  return (
    <Fragment>
    <FullScreenPanel title="Hacer una reserva" onClose={onClose} steps={steps}>
      {error && (
        <p className="mb-4 whitespace-pre-line rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      <IndicadorPasos paso={fase === "elegir" ? 1 : fase === "dia" ? 2 : 3} />

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
            <section key={b.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
                {b.nombre}
              </h3>
              <div className="hidden grid-cols-[minmax(0,7rem)_1fr_1fr] gap-3 px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:grid dark:text-slate-500">
                <span>Planta</span>
                <span>{tipoLabel("manana")}</span>
                <span>{tipoLabel("tarde")}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {b.plantas.map((p) => (
                  <div key={p.id} className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,7rem)_1fr_1fr] sm:items-stretch sm:gap-3">
                    <p className="text-sm font-medium text-slate-700 sm:pt-2 dark:text-slate-200">{p.nombre}</p>
                    {(["manana", "tarde"] as const).map((tipo) => {
                      const t = p.turnos.find((x) => x.tipo === tipo);
                      if (!t) {
                        return (
                          <div key={tipo} className="hidden items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-300 sm:flex dark:border-slate-700 dark:text-slate-600">
                            Sin turno
                          </div>
                        );
                      }
                      const estado = estadoTurnos?.find((e) => e.turnoId === t.id);
                      const deshabilitado = estado ? !estado.disponibleAhora : false;
                      // La sala sigue abierta para reservar (puede tener hueco mañana), pero hoy no
                      // queda ni un asiento: se muestra apagada para que se note de un vistazo, sin
                      // bloquear el clic (mañana sí puede haber sitio).
                      const completoHoy = !deshabilitado && estado?.plazasLibresHoy === 0;
                      const enCesta = cesta.filter((c) => c.turno.id === t.id).length;
                      const libres = estado?.plazasLibresHoy ?? null;
                      const total = estado?.plazasTotalesHoy ?? null;
                      const pct = libres !== null && total ? Math.round((libres / total) * 100) : null;
                      const barColor =
                        estado?.avisoPlazasHoy === "criticas" ? "bg-red-500" : estado?.avisoPlazasHoy === "pocas" ? "bg-amber-500" : "bg-emerald-500";
                      const textoColor =
                        completoHoy || estado?.avisoPlazasHoy === "criticas"
                          ? "text-red-600 dark:text-red-400"
                          : estado?.avisoPlazasHoy === "pocas"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-700 dark:text-emerald-400";
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={deshabilitado}
                          title={deshabilitado ? (estado?.mensaje ?? undefined) : completoHoy ? "Hoy no queda ningún asiento libre, pero puedes mirar otro día" : undefined}
                          onClick={() => elegirTurno(t)}
                          className={`relative flex min-h-[5.5rem] flex-col justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm shadow-sm transition ${
                            deshabilitado
                              ? "cursor-not-allowed border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
                              : `hover:border-brand-400 dark:hover:border-brand-500 ${
                                  enCesta > 0
                                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30"
                                    : completoHoy || estado?.avisoPlazasHoy === "criticas"
                                      ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
                                      : estado?.avisoPlazasHoy === "pocas"
                                        ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
                                        : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                                }`
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`absolute -left-2.5 bottom-0 top-0 w-1 rounded-full ${tipo === "manana" ? "bg-amber-400 dark:bg-amber-500" : "bg-indigo-400 dark:bg-indigo-500"}`}
                          />
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-semibold text-slate-700 sm:hidden dark:text-slate-200">{tipoLabel(tipo)} · </span>
                              {t.horario}
                            </span>
                            {enCesta > 0 && (
                              <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
                                En la cesta{enCesta > 1 ? ` ×${enCesta}` : ""}
                              </span>
                            )}
                          </span>
                          {deshabilitado ? (
                            <span className="text-sm leading-snug text-slate-500 dark:text-slate-400">
                              {estado?.mensaje ?? "No disponible por ahora"}
                            </span>
                          ) : (
                            <>
                              {libres !== null && !completoHoy ? (
                                <span className="flex items-baseline gap-1.5">
                                  <span className={`text-2xl font-bold leading-none ${textoColor}`}>{libres}</span>
                                  <span className="text-xs text-slate-600 dark:text-slate-300">
                                    {total ? `de ${total} ` : ""}libres hoy
                                  </span>
                                </span>
                              ) : (
                                <span className={`text-sm font-semibold ${completoHoy ? textoColor : "text-slate-600 dark:text-slate-300"}`}>
                                  {completoHoy ? "Completo hoy · prueba otro día" : "Elegir día"}
                                </span>
                              )}
                              {pct !== null && (
                                <span className="h-2 w-full overflow-hidden rounded-full bg-white/80 dark:bg-slate-700" aria-hidden="true">
                                  <span className={`block h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {fase === "dia" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button type="button" onClick={volverAElegir} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
              ← Volver a elegir turnos
            </button>
            {cesta.length > 0 && (
              <button type="button" onClick={() => setFase("cesta")} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
                Ver cesta ({cesta.length})
              </button>
            )}
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {bibliotecaActual?.nombre} · {plantaActual?.nombre} · {turnoActual ? tipoLabel(turnoActual.tipo) : ""}
          </p>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Día</p>
            {loading && performances.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Consultando días disponibles…</p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {performances.map((p) => {
                const enCesta = cesta.some((c) => c.turno.id === turnoActual?.id && c.perf.perfId === p.perfId);
                const bloqueado = !p.available || !!p.yaReservada || enCesta;
                const elegido = perf?.perfId === p.perfId;
                return (
                  <button
                    key={p.perfId}
                    type="button"
                    disabled={bloqueado}
                    onClick={() => {
                      setPerf(p);
                      setSeat(null);
                      setSeats([]);
                    }}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                      elegido
                        ? "border-brand-500 bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                        : !bloqueado
                          ? "border-slate-200 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-brand-500"
                          : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400"
                    }`}
                  >
                    <p className="font-medium">{p.label.split("No estará")[0]}</p>
                    {!p.available && p.availableFromText && (
                      <p className="mt-0.5 text-xs leading-snug">{p.availableFromText}</p>
                    )}
                    {p.available && p.yaReservada && <p className="mt-0.5 text-xs leading-snug">Ya tienes reserva</p>}
                    {p.available && !p.yaReservada && enCesta && <p className="mt-0.5 text-xs leading-snug">En tu cesta</p>}
                  </button>
                );
              })}
            </div>
          </div>

          {!perf ? (
            !loading && performances.length > 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
                Elige un día para ver los asientos.
              </p>
            )
          ) : (
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
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Asiento</p>
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
          )}
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
      {exito && <SuccessOverlay />}
    </Fragment>
  );
}
