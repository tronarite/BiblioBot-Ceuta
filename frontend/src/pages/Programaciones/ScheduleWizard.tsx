import { useState } from "react";
import { api } from "../../api/client";
import type { Biblioteca, Planta, Programacion } from "../../api/types";
import { FullScreenPanel } from "../../components/FullScreenPanel";
import { ImageLightbox } from "../../components/ImageLightbox";
import { BTN, IndicadorPasos, PlanoPlegable, PRIM, usePlanoAbierto } from "../../components/WizardParts";

const PASOS = ["Qué y cuándo", "Repetición y días", "Asientos"];

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

  const [step, setStep] = useState(editando ? 3 : 1);
  const [nombre, setNombre] = useState(editando?.nombre ?? "");
  const [biblioteca, setBiblioteca] = useState<Biblioteca | null>(bibliotecaInicial);
  const [planta, setPlanta] = useState<Planta | null>(plantaInicial);
  const [turnos, setTurnos] = useState<Array<"manana" | "tarde">>(editando ? JSON.parse(editando.turnos) : []);
  const [tipo, setTipo] = useState<Programacion["tipo"]>(editando?.tipo ?? "indefinida");
  const [valorNumero, setValorNumero] = useState(editando?.valorTipoNumero ?? 10);
  const [valorFecha, setValorFecha] = useState(editando?.valorTipoFecha ? editando.valorTipoFecha.slice(0, 10) : "");
  const [dias, setDias] = useState<number[]>(editando ? JSON.parse(editando.diasSemana) : []);
  const [asientos, setAsientos] = useState<string[]>(() => {
    if (!editando) return [""];
    try {
      const lista = JSON.parse(editando.asientosCodigos) as string[];
      return lista.length ? lista : [""];
    } catch {
      return [""];
    }
  });
  const [planoAmpliado, setPlanoAmpliado] = useState(false);
  const [planoAbierto, alternarPlano] = usePlanoAbierto();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleDia(d: number) {
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  const asientosLimpios = asientos.map((a) => a.trim()).filter(Boolean);

  async function confirmar() {
    if (!biblioteca || !planta || asientosLimpios.length === 0) return;
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
      asientosCodigos: asientosLimpios,
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
  const nombreTurnos = turnos.map((t) => (t === "manana" ? "Mañana" : "Tarde")).join(" y ");
  const tipoTexto =
    tipo === "n_reservas" ? `${valorNumero} reservas y se pausa` : tipo === "hasta_fecha" ? `Hasta el ${valorFecha || "…"}` : "Indefinida";

  // Cada paso se puede continuar solo cuando está completo.
  const paso1Completo = !!planta && turnos.length > 0;
  const paso2Completo = dias.length > 0 && (tipo !== "hasta_fecha" || !!valorFecha) && (tipo !== "n_reservas" || valorNumero >= 1);
  const paso3Completo = asientosLimpios.length > 0;

  const chip = (activo: boolean, deshabilitado = false) =>
    `rounded-lg border px-3 py-2 text-left text-sm transition ${
      deshabilitado
        ? "cursor-not-allowed border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-600"
        : activo
          ? "border-brand-500 bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
          : "border-slate-200 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-brand-500"
    }`;
  const inputClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";
  const seccion = "mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500";

  const barra =
    step === 1 ? (
      <>
        <button type="button" onClick={onClose} className={BTN}>
          Cancelar
        </button>
        <span className="flex-1" />
        <button type="button" onClick={() => setStep(2)} disabled={!paso1Completo} className={PRIM}>
          Continuar
        </button>
      </>
    ) : step === 2 ? (
      <>
        <button type="button" onClick={() => setStep(1)} className={BTN}>
          ← Atrás
        </button>
        <span className="flex-1" />
        <button type="button" onClick={() => setStep(3)} disabled={!paso2Completo} className={PRIM}>
          Continuar
        </button>
      </>
    ) : (
      <>
        <button type="button" onClick={() => setStep(2)} className={BTN}>
          ← Atrás
        </button>
        <span className="flex-1" />
        <button type="button" onClick={confirmar} disabled={loading || !paso3Completo} className={PRIM}>
          {loading ? (editando ? "Guardando…" : "Creando…") : editando ? "Guardar cambios" : "Crear programación"}
        </button>
      </>
    );

  return (
    <FullScreenPanel
      title={editando ? "Editar programación" : "Nueva programación"}
      onClose={onClose}
      footer={barra}
      steps={[
        { label: "Nombre", value: nombre.trim() || null, onEdit: () => setStep(1) },
        { label: "Biblioteca y planta", value: planta ? `${biblioteca?.nombre} · ${planta.nombre}` : null, onEdit: () => setStep(1) },
        { label: "Turnos", value: turnos.length ? nombreTurnos : null, onEdit: () => setStep(1) },
        { label: "Repetición", value: dias.length ? tipoTexto : null, onEdit: () => setStep(2) },
        { label: "Días", value: dias.length ? ordenarDias(dias).map((d) => DIAS[d].slice(0, 3)).join(", ") : null, onEdit: () => setStep(2) },
        { label: "Asientos (por orden)", value: asientosLimpios.length ? asientosLimpios.join(", ") : null, onEdit: asientosLimpios.length ? () => setStep(3) : undefined },
      ]}
    >
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>
      )}

      <IndicadorPasos pasos={PASOS} paso={step} />

      {step === 1 && (
        <div className="space-y-6">
          <div className="max-w-sm">
            <label htmlFor="prog-nombre" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nombre (opcional)
            </label>
            <input
              id="prog-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Estudio por las tardes"
              maxLength={80}
              className={`w-full ${inputClass}`}
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Si lo dejas en blanco, se usará el nombre de la biblioteca y la planta.
            </p>
          </div>

          {bibliotecas.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Has ocultado todas las bibliotecas desde Cuenta. Vuelve a marcar alguna ahí para poder programar.
            </p>
          )}
          <div>
            <p className={seccion}>Biblioteca y planta</p>
            <div className="space-y-4">
              {bibliotecas.map((b) => (
                <section key={b.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
                    {b.nombre}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:grid-cols-3">
                    {b.plantas.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (planta?.id !== p.id) setTurnos([]);
                          setBiblioteca(b);
                          setPlanta(p);
                        }}
                        className={chip(planta?.id === p.id)}
                      >
                        {p.nombre}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div>
            <p className={seccion}>Turnos</p>
            {!planta ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Elige primero una planta.</p>
            ) : (
              <div className="grid max-w-md grid-cols-2 gap-3">
                {(["manana", "tarde"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={turnos.includes(t)}
                    onClick={() => setTurnos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
                    className={chip(turnos.includes(t))}
                  >
                    {t === "manana" ? "Mañana" : "Tarde"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && biblioteca && planta && (
        <div className="space-y-6">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {biblioteca.nombre} · {planta.nombre} · {nombreTurnos}
          </p>

          <div>
            <p className={seccion}>Días de la semana</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ORDEN_SEMANA.map((i) => {
                const motivos = turnos.map((t) => reglaPermite(biblioteca, planta, t, i)).filter(Boolean);
                const invalido = motivos.length === turnos.length && turnos.length > 0;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={invalido}
                    aria-pressed={dias.includes(i)}
                    title={motivos[0] ?? undefined}
                    onClick={() => toggleDia(i)}
                    className={chip(dias.includes(i), invalido)}
                  >
                    {DIAS[i]}
                    {invalido && <span className="block text-xs">{motivos[0]}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-w-md">
            <p className={seccion}>Cuánto tiempo se repite</p>
            <div className="space-y-2">
              {(
                [
                  ["indefinida", "Indefinida, hasta cancelación manual"],
                  ["n_reservas", "Un número de reservas y se pausa"],
                  ["hasta_fecha", "Hasta un día concreto"],
                ] as const
              ).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={tipo === value} onClick={() => setTipo(value)} className={`block w-full ${chip(tipo === value)}`}>
                  {label}
                </button>
              ))}
            </div>
            {tipo === "n_reservas" && (
              <input
                type="number"
                min={1}
                value={valorNumero}
                onChange={(e) => setValorNumero(Number(e.target.value))}
                aria-label="Número de reservas"
                className={`mt-3 w-full ${inputClass}`}
              />
            )}
            {tipo === "hasta_fecha" && (
              <input
                type="date"
                value={valorFecha}
                onChange={(e) => setValorFecha(e.target.value)}
                aria-label="Fecha final"
                className={`mt-3 w-full ${inputClass}`}
              />
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {biblioteca?.nombre} · {planta?.nombre} · {nombreTurnos} · {ordenarDias(dias).map((d) => DIAS[d].slice(0, 3)).join(", ")}
          </p>

          <div className="flex flex-col gap-6">
            <div className="max-w-md space-y-3">
              <p className={seccion}>Asientos por orden de preferencia</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Se intentan de arriba abajo: si el primero no está libre a la hora de reservar, prueba con el siguiente.
                Mira el plano y escribe el número del asiento (la fila la determina la sala).
              </p>
              {asientos.map((valor, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 text-right text-xs text-slate-400 dark:text-slate-500">{i + 1}.</span>
                  <input
                    value={valor}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, "");
                      setAsientos((prev) => prev.map((x, j) => (j === i ? v : x)));
                    }}
                    inputMode="numeric"
                    placeholder="Ej. 24"
                    aria-label={`Asiento ${i + 1}`}
                    className={`w-32 ${inputClass}`}
                  />
                  {asientos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAsientos((prev) => prev.filter((_, j) => j !== i))}
                      className="text-xs text-red-500 hover:underline dark:text-red-400"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
              {asientos.length < 10 && (
                <button
                  type="button"
                  onClick={() => setAsientos((prev) => [...prev, ""])}
                  className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  + Añadir otro asiento
                </button>
              )}
            </div>

            <div className="max-w-md rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <p className={seccion}>Resumen</p>
              <p>
                <span className="text-slate-500 dark:text-slate-400">Nombre:</span> {nombre.trim() || `${biblioteca?.nombre} · ${planta?.nombre}`}
              </p>
              <p>
                <span className="text-slate-500 dark:text-slate-400">Repetición:</span> {tipoTexto}
              </p>
              <p>
                <span className="text-slate-500 dark:text-slate-400">Días:</span> {ordenarDias(dias).map((d) => DIAS[d]).join(", ")}
              </p>
              <p>
                <span className="text-slate-500 dark:text-slate-400">Asientos:</span> {asientosLimpios.join(", ") || "—"}
              </p>
            </div>

            {plano ? (
              <PlanoPlegable
                src={plano}
                planta={planta?.nombre ?? ""}
                abierto={planoAbierto}
                onAlternar={alternarPlano}
                onAmpliar={() => setPlanoAmpliado(true)}
                className="max-w-xl"
              />
            ) : (
              <div className="flex h-32 max-w-xl items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
                No hay plano disponible para esta sala todavía
              </div>
            )}
          </div>
        </div>
      )}

      {planoAmpliado && plano && (
        <ImageLightbox src={plano} alt={`Plano de ${planta?.nombre}`} onClose={() => setPlanoAmpliado(false)} />
      )}
    </FullScreenPanel>
  );
}
