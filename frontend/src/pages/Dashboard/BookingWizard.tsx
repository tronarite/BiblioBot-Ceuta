import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { parseSpanishDateLabel } from "../../api/dateEs";
import type { Biblioteca, EstadoTurno, PerformanceOption, PerformancesResponse, Planta, SeatInfo, Turno } from "../../api/types";
import { FullScreenPanel } from "../../components/FullScreenPanel";
import { SeatMapViewer } from "../../components/SeatMapViewer";

type Step = 1 | 2 | 3 | 4;

export function BookingWizard({
  bibliotecas,
  onClose,
  onCreated,
}: {
  bibliotecas: Biblioteca[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [planta, setPlanta] = useState<Planta | null>(null);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [performances, setPerformances] = useState<PerformanceOption[]>([]);
  const [perf, setPerf] = useState<PerformanceOption | null>(null);
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [seat, setSeat] = useState<SeatInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estadoTurnos, setEstadoTurnos] = useState<EstadoTurno[] | null>(null);

  const biblioteca = planta ? bibliotecas.find((b) => b.plantas.some((p) => p.id === planta.id)) ?? null : null;

  useEffect(() => {
    api
      .get<EstadoTurno[]>("/libraries/turnos-estado")
      .then(setEstadoTurnos)
      .catch(() => setEstadoTurnos([]));
  }, []);

  useEffect(() => {
    if (step !== 2 || !turno) return;
    setLoading(true);
    setError(null);
    api
      .get<PerformancesResponse>(`/reservations/performances?turnoId=${turno.id}`)
      .then((res) => setPerformances(res.options))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [step, turno]);

  useEffect(() => {
    if (step !== 3 || !turno || !perf) return;
    setLoading(true);
    setError(null);
    api
      .get<{ seats: SeatInfo[] }>(`/reservations/seatmap?turnoId=${turno.id}&perfId=${perf.perfId}`)
      .then((res) => setSeats(res.seats))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [step, turno, perf]);

  async function confirmar() {
    if (!turno || !perf || !seat) return;
    setLoading(true);
    setError(null);
    try {
      const fecha = parseSpanishDateLabel(perf.label) ?? new Date();
      await api.post("/reservations", {
        turnoId: turno.id,
        perfId: perf.perfId,
        fecha: fecha.toISOString(),
        seat: {
          sectionId: seat.sectionId,
          areaId: seat.areaId,
          rowId: seat.rowId,
          seatId: seat.seatId,
          seatTypeId: seat.seatTypeId,
          label: seat.label,
        },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la reserva");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FullScreenPanel
      title="Hacer una reserva"
      onClose={onClose}
      steps={[
        { label: "Biblioteca y turno", value: turno ? `${biblioteca?.nombre} · ${planta?.nombre} · ${turno.tipo}` : null, onEdit: () => setStep(1) },
        { label: "Día", value: perf?.label ?? null, onEdit: perf ? () => setStep(2) : undefined },
        { label: "Asiento", value: seat?.label ?? null, onEdit: seat ? () => setStep(3) : undefined },
      ]}
    >
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {step === 1 && (
        <div className="space-y-6">
          {bibliotecas.map((b) => (
            <div key={b.id}>
              <h3 className="mb-2 font-medium text-slate-700">{b.nombre}</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {b.plantas.flatMap((p) =>
                  p.turnos.map((t) => {
                    const estado = estadoTurnos?.find((e) => e.turnoId === t.id);
                    const deshabilitado = estado ? !estado.disponibleAhora : false;
                    return (
                      <button
                        key={t.id}
                        disabled={deshabilitado}
                        title={deshabilitado ? (estado?.mensaje ?? undefined) : undefined}
                        onClick={() => {
                          setPlanta(p);
                          setTurno(t);
                          setPerf(null);
                          setSeat(null);
                          setStep(2);
                        }}
                        className={`rounded-xl border p-3 text-left text-sm transition ${
                          deshabilitado
                            ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                            : `hover:border-brand-400 ${turno?.id === t.id ? "border-brand-500 bg-brand-50" : "border-slate-200"}`
                        }`}
                      >
                        <p className="font-medium">
                          {p.nombre} · {t.tipo === "manana" ? "Mañana" : "Tarde"}
                        </p>
                        {deshabilitado ? (
                          <p className="mt-1 text-xs">{estado?.mensaje ?? "No disponible por ahora"}</p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">{t.horario}</p>
                        )}
                      </button>
                    );
                  }),
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 2 && (
        <div>
          {loading && <p className="text-sm text-slate-500">Consultando días disponibles…</p>}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {performances.map((p) => (
              <button
                key={p.perfId}
                disabled={!p.available}
                onClick={() => {
                  setPerf(p);
                  setSeat(null);
                  setStep(3);
                }}
                className={`rounded-xl border p-3 text-left text-sm transition ${
                  p.available ? "border-slate-200 hover:border-brand-400" : "cursor-not-allowed border-slate-100 text-slate-300"
                }`}
              >
                <p className="font-medium">{p.label.split("No estará")[0]}</p>
                {!p.available && p.availableFromText && <p className="mt-1 text-xs">{p.availableFromText}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          {loading && <p className="mb-3 text-sm text-slate-500">Cargando mapa de asientos…</p>}
          <SeatMapViewer seats={seats} mode="single" selected={seat} onSelect={(s) => setSeat(s)} />
          {seat && (
            <button onClick={() => setStep(4)} className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Continuar
            </button>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="max-w-md space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p>
              <span className="text-slate-500">Biblioteca:</span> {biblioteca?.nombre}
            </p>
            <p>
              <span className="text-slate-500">Planta / turno:</span> {planta?.nombre} · {turno?.tipo}
            </p>
            <p>
              <span className="text-slate-500">Día:</span> {perf?.label.split("No estará")[0]}
            </p>
            <p>
              <span className="text-slate-500">Asiento:</span> {seat?.label}
            </p>
          </div>
          <button
            onClick={confirmar}
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Confirmando…" : "Confirmar reserva"}
          </button>
        </div>
      )}
    </FullScreenPanel>
  );
}
