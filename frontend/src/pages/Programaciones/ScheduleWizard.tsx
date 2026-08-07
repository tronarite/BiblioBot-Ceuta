import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Biblioteca, Planta, PerformancesResponse, Programacion, SeatInfo } from "../../api/types";
import { FullScreenPanel } from "../../components/FullScreenPanel";
import { SeatMapViewer } from "../../components/SeatMapViewer";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function reglaPermite(biblioteca: Biblioteca, planta: Planta, turnoTipo: "manana" | "tarde", dia: number): string | null {
  const reglasB = biblioteca.reglasEspeciales ? JSON.parse(biblioteca.reglasEspeciales) : {};
  const reglasP = planta.reglasEspeciales ? JSON.parse(planta.reglasEspeciales) : {};
  if (reglasB.sinReservaDomingo && dia === 0) return "Sin reservas los domingos";
  if (reglasB.sinReservaSabadoTarde && dia === 6 && turnoTipo === "tarde") return "Sin reservas sábado tarde";
  if (reglasP.cerradaSabadoManana && dia === 6 && turnoTipo === "manana") return "Cerrada sábado mañana";
  return null;
}

export function ScheduleWizard({
  bibliotecas,
  onClose,
  onCreated,
}: {
  bibliotecas: Biblioteca[];
  onClose: () => void;
  onCreated: (p: Programacion) => void;
}) {
  const [step, setStep] = useState(1);
  const [biblioteca, setBiblioteca] = useState<Biblioteca | null>(null);
  const [planta, setPlanta] = useState<Planta | null>(null);
  const [turnos, setTurnos] = useState<Array<"manana" | "tarde">>([]);
  const [tipo, setTipo] = useState<Programacion["tipo"]>("indefinida");
  const [valorNumero, setValorNumero] = useState(10);
  const [valorFecha, setValorFecha] = useState("");
  const [dias, setDias] = useState<number[]>([]);
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [preferido, setPreferido] = useState<SeatInfo | null>(null);
  const [alternativo, setAlternativo] = useState<SeatInfo | null>(null);
  const [pickingAlternate, setPickingAlternate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step !== 5 || !planta || turnos.length === 0) return;
    const turno = planta.turnos.find((t) => t.tipo === turnos[0]);
    if (!turno) return;
    setLoading(true);
    setError(null);
    api
      .get<PerformancesResponse>(`/reservations/performances?turnoId=${turno.id}`)
      .then((res) => {
        const disponible = res.options.find((p) => p.available);
        if (!disponible) {
          throw new Error(res.noDisponibleTexto ?? "No hay ningún día disponible ahora mismo para ver el mapa de asientos");
        }
        return api.get<{ seats: SeatInfo[] }>(`/reservations/seatmap?turnoId=${turno.id}&perfId=${disponible.perfId}`);
      })
      .then((res) => setSeats(res.seats))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [step, planta, turnos]);

  function toggleDia(d: number) {
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function seatClick(seat: SeatInfo) {
    if (!pickingAlternate) {
      setPreferido(seat);
      setPickingAlternate(true);
    } else {
      setAlternativo(seat);
    }
  }

  async function confirmar() {
    if (!biblioteca || !planta || !preferido) return;
    setLoading(true);
    setError(null);
    try {
      const programacion = await api.post<Programacion>("/schedules", {
        bibliotecaId: biblioteca.id,
        plantaId: planta.id,
        turnos,
        tipo,
        valorTipoNumero: tipo === "n_reservas" ? valorNumero : undefined,
        valorTipoFecha: tipo === "hasta_fecha" ? valorFecha : undefined,
        diasSemana: dias,
        asientoPreferidoCodigo: preferido.label,
        asientoAlternativoCodigo: alternativo?.label,
      });
      onCreated(programacion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la programación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FullScreenPanel
      title="Nueva programación"
      onClose={onClose}
      steps={[
        { label: "Biblioteca y planta", value: planta ? `${biblioteca?.nombre} · ${planta.nombre}` : null, onEdit: () => setStep(1) },
        { label: "Turnos", value: turnos.length ? turnos.map((t) => (t === "manana" ? "Mañana" : "Tarde")).join(" y ") : null, onEdit: () => setStep(2) },
        { label: "Tipo", value: tipo, onEdit: () => setStep(3) },
        { label: "Días", value: dias.length ? dias.map((d) => DIAS[d].slice(0, 3)).join(", ") : null, onEdit: () => setStep(4) },
        { label: "Opción 1 (preferida)", value: preferido?.label ?? null, onEdit: preferido ? () => setStep(5) : undefined },
        { label: "Opción 2 (alternativa)", value: alternativo?.label ?? null },
      ]}
    >
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {step === 1 && (
        <div className="space-y-6">
          {bibliotecas.map((b) => (
            <div key={b.id}>
              <h3 className="mb-2 font-medium text-slate-700">{b.nombre}</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {b.plantas.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setBiblioteca(b);
                      setPlanta(p);
                      setTurnos([]);
                      setStep(2);
                    }}
                    className={`rounded-xl border p-3 text-left text-sm hover:border-brand-400 ${
                      planta?.id === p.id ? "border-brand-500 bg-brand-50" : "border-slate-200"
                    }`}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 2 && planta && (
        <div className="max-w-sm space-y-3">
          {(["manana", "tarde"] as const).map((t) => (
            <label key={t} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <input
                type="checkbox"
                checked={turnos.includes(t)}
                onChange={() => setTurnos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
              />
              {t === "manana" ? "Mañana" : "Tarde"}
            </label>
          ))}
          <button
            disabled={turnos.length === 0}
            onClick={() => setStep(3)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Continuar
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="max-w-sm space-y-4">
          {(
            [
              ["n_reservas", "Nº de reservas antes de pausar"],
              ["hasta_fecha", "Reservar hasta un día concreto"],
              ["indefinida", "Indefinida, hasta cancelación manual"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <input type="radio" checked={tipo === value} onChange={() => setTipo(value)} />
              {label}
            </label>
          ))}
          {tipo === "n_reservas" && (
            <input
              type="number"
              min={1}
              value={valorNumero}
              onChange={(e) => setValorNumero(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          )}
          {tipo === "hasta_fecha" && (
            <input
              type="date"
              value={valorFecha}
              onChange={(e) => setValorFecha(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          )}
          <button onClick={() => setStep(4)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
            Continuar
          </button>
        </div>
      )}

      {step === 4 && biblioteca && planta && (
        <div className="max-w-md space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {DIAS.map((label, i) => {
              const motivos = turnos.map((t) => reglaPermite(biblioteca, planta, t, i)).filter(Boolean);
              const invalido = motivos.length === turnos.length && turnos.length > 0;
              return (
                <label
                  key={label}
                  title={motivos[0] ?? undefined}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
                    invalido ? "cursor-not-allowed border-slate-100 text-slate-300" : "border-slate-200"
                  }`}
                >
                  <input type="checkbox" disabled={invalido} checked={dias.includes(i)} onChange={() => toggleDia(i)} />
                  {label}
                </label>
              );
            })}
          </div>
          <button
            disabled={dias.length === 0}
            onClick={() => setStep(5)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Continuar
          </button>
        </div>
      )}

      {step === 5 && (
        <div>
          {loading && <p className="mb-3 text-sm text-slate-500">Cargando mapa de asientos…</p>}
          <SeatMapViewer
            seats={seats}
            mode="double"
            selected={preferido}
            selectedAlternate={alternativo}
            pickingAlternate={pickingAlternate}
            onSelect={seatClick}
          />
          <div className="mt-4 flex gap-2">
            {preferido && (
              <button
                onClick={() => setStep(6)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Continuar {alternativo ? "" : "sin alternativa"}
              </button>
            )}
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="max-w-md space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm space-y-1">
            <p>
              <span className="text-slate-500">Biblioteca / planta:</span> {biblioteca?.nombre} · {planta?.nombre}
            </p>
            <p>
              <span className="text-slate-500">Turnos:</span> {turnos.map((t) => (t === "manana" ? "Mañana" : "Tarde")).join(" y ")}
            </p>
            <p>
              <span className="text-slate-500">Días:</span> {dias.map((d) => DIAS[d]).join(", ")}
            </p>
            <p>
              <span className="text-slate-500">Preferido:</span> {preferido?.label}
            </p>
            <p>
              <span className="text-slate-500">Alternativo:</span> {alternativo?.label ?? "—"}
            </p>
          </div>
          <button
            onClick={confirmar}
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Creando…" : "Crear programación"}
          </button>
        </div>
      )}
    </FullScreenPanel>
  );
}
