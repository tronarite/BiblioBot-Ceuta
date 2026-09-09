import { useState } from "react";
import { api } from "../../api/client";
import type { Biblioteca, Planta, Programacion } from "../../api/types";
import { FullScreenPanel } from "../../components/FullScreenPanel";
import { ImageLightbox } from "../../components/ImageLightbox";

// Índice = día de la semana según Date.getDay() (0 = domingo); ORDEN_SEMANA solo
// reordena cómo se muestran, para que la semana visualmente empiece en lunes.
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

function ordenarDias(dias: number[]): number[] {
  return [...dias].sort((a, b) => ORDEN_SEMANA.indexOf(a) - ORDEN_SEMANA.indexOf(b));
}

const PLANO_POR_PLANTA: Record<string, string> = {
  "3ª Planta": "/Planta3.jpg",
  "4ª Planta": "/Planta4.jpg",
  "5ª Planta": "/Planta5.jpg",
};

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
  programacion: editando,
  onClose,
  onCreated,
}: {
  bibliotecas: Biblioteca[];
  programacion?: Programacion | null;
  onClose: () => void;
  onCreated: (p: Programacion) => void;
}) {
  const bibliotecaInicial = editando ? (bibliotecas.find((b) => b.id === editando.bibliotecaId) ?? null) : null;
  const plantaInicial = bibliotecaInicial ? (bibliotecaInicial.plantas.find((p) => p.id === editando!.plantaId) ?? null) : null;

  const [step, setStep] = useState(editando ? 6 : 1);
  const [nombre, setNombre] = useState(editando?.nombre ?? "");
  const [biblioteca, setBiblioteca] = useState<Biblioteca | null>(bibliotecaInicial);
  const [planta, setPlanta] = useState<Planta | null>(plantaInicial);
  const [turnos, setTurnos] = useState<Array<"manana" | "tarde">>(editando ? JSON.parse(editando.turnos) : []);
  const [tipo, setTipo] = useState<Programacion["tipo"]>(editando?.tipo ?? "indefinida");
  const [valorNumero, setValorNumero] = useState(editando?.valorTipoNumero ?? 10);
  const [valorFecha, setValorFecha] = useState(editando?.valorTipoFecha ? editando.valorTipoFecha.slice(0, 10) : "");
  const [dias, setDias] = useState<number[]>(editando ? JSON.parse(editando.diasSemana) : []);
  const [preferidoCodigo, setPreferidoCodigo] = useState(editando?.asientoPreferidoCodigo ?? "");
  const [alternativoCodigo, setAlternativoCodigo] = useState(editando?.asientoAlternativoCodigo ?? "");
  const [planoAmpliado, setPlanoAmpliado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleDia(d: number) {
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function confirmar() {
    if (!biblioteca || !planta || !preferidoCodigo.trim()) return;
    setLoading(true);
    setError(null);
    const payload = {
      nombre: nombre.trim() || undefined,
      bibliotecaId: biblioteca.id,
      plantaId: planta.id,
      turnos,
      tipo,
      valorTipoNumero: tipo === "n_reservas" ? valorNumero : undefined,
      valorTipoFecha: tipo === "hasta_fecha" ? valorFecha : undefined,
      diasSemana: dias,
      asientoPreferidoCodigo: preferidoCodigo.trim(),
      asientoAlternativoCodigo: alternativoCodigo.trim() || undefined,
    };
    try {
      const programacion = editando
        ? await api.patch<Programacion>(`/schedules/${editando.id}`, payload)
        : await api.post<Programacion>("/schedules", payload);
      onCreated(programacion);
    } catch (err) {
      setError(err instanceof Error ? err.message : `No se pudo ${editando ? "guardar" : "crear"} la programación`);
    } finally {
      setLoading(false);
    }
  }

  const plano = planta ? PLANO_POR_PLANTA[planta.nombre] : undefined;

  return (
    <FullScreenPanel
      title={editando ? "Editar programación" : "Nueva programación"}
      onClose={onClose}
      steps={[
        { label: "Nombre", value: nombre.trim() || null, onEdit: () => setStep(1) },
        { label: "Biblioteca y planta", value: planta ? `${biblioteca?.nombre} · ${planta.nombre}` : null, onEdit: () => setStep(1) },
        { label: "Turnos", value: turnos.length ? turnos.map((t) => (t === "manana" ? "Mañana" : "Tarde")).join(" y ") : null, onEdit: () => setStep(2) },
        { label: "Tipo", value: tipo, onEdit: () => setStep(3) },
        { label: "Días", value: dias.length ? ordenarDias(dias).map((d) => DIAS[d].slice(0, 3)).join(", ") : null, onEdit: () => setStep(4) },
        { label: "Asiento preferido", value: preferidoCodigo || null, onEdit: preferidoCodigo ? () => setStep(5) : undefined },
        { label: "Asiento alternativo", value: alternativoCodigo || null },
      ]}
    >
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="max-w-sm">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nombre de la programación (opcional)
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Estudio por las tardes"
              maxLength={80}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Te ayuda a diferenciar para qué sirve cada programación. Si lo dejas en blanco, se usará el nombre de la
              biblioteca y la planta.
            </p>
          </div>
          {bibliotecas.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Has ocultado todas las bibliotecas desde Cuenta. Vuelve a marcar alguna ahí para poder programar.
            </p>
          )}
          {bibliotecas.map((b) => (
            <div key={b.id}>
              <h3 className="mb-2 font-medium text-slate-700 dark:text-slate-200">{b.nombre}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {b.plantas.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setBiblioteca(b);
                      setPlanta(p);
                      setTurnos([]);
                      setStep(2);
                    }}
                    className={`rounded-xl border p-3 text-left text-sm hover:border-brand-400 dark:text-slate-100 dark:hover:border-brand-500 ${
                      planta?.id === p.id
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30"
                        : "border-slate-200 dark:border-slate-700 dark:bg-slate-800"
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
            <label
              key={t}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
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
            <label
              key={value}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
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
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          )}
          {tipo === "hasta_fecha" && (
            <input
              type="date"
              value={valorFecha}
              onChange={(e) => setValorFecha(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
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
            {ORDEN_SEMANA.map((i) => {
              const label = DIAS[i];
              const motivos = turnos.map((t) => reglaPermite(biblioteca, planta, t, i)).filter(Boolean);
              const invalido = motivos.length === turnos.length && turnos.length > 0;
              return (
                <label
                  key={label}
                  title={motivos[0] ?? undefined}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
                    invalido
                      ? "cursor-not-allowed border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-600"
                      : "border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
        <div className="grid max-w-3xl gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
              Como las programaciones se preparan con antelación, el turno elegido puede que todavía no tenga hueco abierto en
              PatronBase para ver el mapa de asientos en vivo. Consulta el plano de la sala y escribe el número del asiento
              que quieras (la fila la determina la sala, no hace falta indicarla).
            </p>
            {plano ? (
              <button type="button" onClick={() => setPlanoAmpliado(true)} className="block w-full">
                <img
                  src={plano}
                  alt={`Plano de ${planta?.nombre}`}
                  className="w-full cursor-zoom-in rounded-xl border border-slate-200 dark:border-slate-700"
                />
                <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">Toca la imagen para verla más grande</p>
              </button>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
                No hay plano disponible para esta sala todavía
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nº de asiento preferido (Opción 1)
              </label>
              <input
                value={preferidoCodigo}
                onChange={(e) => setPreferidoCodigo(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="Ej. 24"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nº de asiento alternativo (Opción 2, opcional)
              </label>
              <input
                value={alternativoCodigo}
                onChange={(e) => setAlternativoCodigo(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="Ej. 25"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Se usa automáticamente si la Opción 1 no está libre en el momento de reservar.
              </p>
            </div>
            <button
              disabled={!preferidoCodigo.trim()}
              onClick={() => setStep(6)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="max-w-md space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm space-y-1 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <p>
              <span className="text-slate-500 dark:text-slate-400">Nombre:</span>{" "}
              {nombre.trim() || `${biblioteca?.nombre} · ${planta?.nombre}`}
            </p>
            <p>
              <span className="text-slate-500 dark:text-slate-400">Biblioteca / planta:</span> {biblioteca?.nombre} ·{" "}
              {planta?.nombre}
            </p>
            <p>
              <span className="text-slate-500 dark:text-slate-400">Turnos:</span>{" "}
              {turnos.map((t) => (t === "manana" ? "Mañana" : "Tarde")).join(" y ")}
            </p>
            <p>
              <span className="text-slate-500 dark:text-slate-400">Días:</span> {ordenarDias(dias).map((d) => DIAS[d]).join(", ")}
            </p>
            <p>
              <span className="text-slate-500 dark:text-slate-400">Preferido:</span> {preferidoCodigo}
            </p>
            <p>
              <span className="text-slate-500 dark:text-slate-400">Alternativo:</span> {alternativoCodigo || "—"}
            </p>
          </div>
          <button
            onClick={confirmar}
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? (editando ? "Guardando…" : "Creando…") : editando ? "Guardar cambios" : "Crear programación"}
          </button>
        </div>
      )}

      {planoAmpliado && plano && (
        <ImageLightbox src={plano} alt={`Plano de ${planta?.nombre}`} onClose={() => setPlanoAmpliado(false)} />
      )}
    </FullScreenPanel>
  );
}
