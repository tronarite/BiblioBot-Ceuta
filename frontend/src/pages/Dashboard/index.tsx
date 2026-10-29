import { Fragment, useEffect, useRef, useState } from "react";
import { CurrentDateTime } from "../../components/CurrentDateTime";
import { NextAttempts } from "../../components/NextAttempts";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { guardarLocal, leerLocal } from "../../api/localCache";
import { useAuth } from "../../auth/AuthContext";
import { useCuentas } from "../../auth/CuentaContext";
import type { Biblioteca, ConCache, DisponibilidadBiblioteca, HorarioExtraordinario, ReservationsResponse } from "../../api/types";
import { AvailabilityBadge } from "../../components/AvailabilityBadge";
import { DataFreshness, type EstadoFrescura } from "../../components/DataFreshness";
import { Dropdown } from "../../components/Dropdown";
import { FailedReservationsNotice } from "../../components/FailedReservationsNotice";
import { MiniMarkdown } from "../../components/MiniMarkdown";
import { BookingWizard } from "./BookingWizard";
import { FloorPlans } from "./FloorPlans";
import { ReservationsList } from "./ReservationsList";

const TABS = [
  { id: "general", label: "General" },
  { id: "planos", label: "Planos de las salas" },
] as const;

const VACIO: ReservationsResponse = { enCurso: [], proximas: [] };
const claveReservas = (usuarioId: string | undefined, cuentaId: string | null) => `dash:reservas:${usuarioId ?? "anon"}:${cuentaId ?? ""}`;

// Mientras el servidor responda con una copia en caché que está refrescando en segundo
// plano ("actualizando"), se vuelve a preguntar cada SONDEO_MS hasta SONDEO_MAX veces
// (~30 s, de sobra para el scraping completo de PatronBase).
const SONDEO_MS = 3000;
const SONDEO_MAX = 10;
// A partir de esta antigüedad los datos se marcan como desactualizados aunque la última
// consulta fuera bien (p. ej. si la pestaña se queda abierta); coincide con el TTL de la
// caché de disponibilidad del backend.
const ANTIGUEDAD_MAX_MS = 3 * 60 * 1000;

type Fuente = "reservas" | "disponibilidad";
type EstadoFuente = { cargando: boolean; error: boolean; actualizadoEn: string | null };
const ESTADO_INICIAL: EstadoFuente = { cargando: true, error: false, actualizadoEn: null };

export function DashboardPage() {
  const { usuario } = useAuth();
  const { claveVista, vistaTodas } = useCuentas();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("general");
  const [bibliotecas, setBibliotecas] = useState<Biblioteca[]>([]);
  // Se inicializan con lo último que se vio (localStorage) para que al entrar/recargar el
  // dashboard muestre datos al instante y solo se actualice en segundo plano si cambian.
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadBiblioteca[] | null>(
    () => leerLocal<DisponibilidadBiblioteca[]>("dash:disponibilidad"),
  );
  const [reservas, setReservas] = useState<ReservationsResponse>(
    () => leerLocal<ReservationsResponse>(claveReservas(usuario?.id, claveVista)) ?? VACIO,
  );
  const [horarios, setHorarios] = useState<HorarioExtraordinario[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [errorReservas, setErrorReservas] = useState<string | null>(null);

  const [fuentes, setFuentes] = useState<Record<Fuente, EstadoFuente>>({
    reservas: ESTADO_INICIAL,
    disponibilidad: ESTADO_INICIAL,
  });
  const [ahora, setAhora] = useState(() => Date.now());
  // Cada refresco incrementa la generación: los sondeos de una carga anterior que sigan
  // en marcha se descartan en vez de pisar el estado de la nueva.
  const generacion = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => {
      clearInterval(t);
      generacion.current++;
    };
  }, []);

  function marcar(fuente: Fuente, cambios: Partial<EstadoFuente>) {
    setFuentes((prev) => ({ ...prev, [fuente]: { ...prev[fuente], ...cambios } }));
  }

  function consultar<T>(
    fuente: Fuente,
    url: string,
    aplicar: (items: T) => void,
    alFallar: (err: unknown) => void,
    gen: number,
    intento = 0,
  ) {
    api
      .get<ConCache<T>>(url)
      .then((res) => {
        if (gen !== generacion.current) return;
        aplicar(res.items);
        if (res.actualizando && intento < SONDEO_MAX) {
          marcar(fuente, { cargando: true, error: false, actualizadoEn: res.actualizadoEn });
          setTimeout(() => consultar(fuente, url, aplicar, alFallar, gen, intento + 1), SONDEO_MS);
          return;
        }
        // Si tras todos los reintentos el servidor sigue sin datos nuevos, se muestra lo
        // que hay pero marcado como desactualizado.
        marcar(fuente, { cargando: false, error: res.actualizando, actualizadoEn: res.actualizadoEn });
      })
      .catch((err) => {
        if (gen !== generacion.current) return;
        marcar(fuente, { cargando: false, error: true });
        alFallar(err);
      });
  }

  function refrescarDatos() {
    const gen = ++generacion.current;
    setAhora(Date.now());
    marcar("reservas", { cargando: true, error: false });
    marcar("disponibilidad", { cargando: true, error: false });
    consultar<ReservationsResponse>(
      "reservas",
      "/reservations",
      (items) => {
        setErrorReservas(null);
        setReservas(items);
        guardarLocal(claveReservas(usuario?.id, claveVista), items);
      },
      (err) => setErrorReservas(err instanceof Error ? err.message : "No se pudieron consultar tus reservas"),
      gen,
    );
    consultar<DisponibilidadBiblioteca[]>(
      "disponibilidad",
      "/libraries/disponibilidad",
      (items) => {
        setDisponibilidad(items);
        guardarLocal("dash:disponibilidad", items);
      },
      () => setDisponibilidad((prev) => prev ?? []),
      gen,
    );
  }

  function cargar() {
    // Peticiones independientes en vez de un único Promise.all: así, si consultar las
    // reservas falla (p. ej. un fallo puntual al iniciar sesión en PatronBase), el resto
    // del dashboard (bibliotecas, avisos, ocupación) se sigue cargando igualmente en vez
    // de quedarse todo en blanco sin explicación.
    api.get<Biblioteca[]>("/libraries").then(setBibliotecas);
    api.get<HorarioExtraordinario[]>("/admin/horarios-extraordinarios").then(setHorarios);
    api
      .get<{ texto: string } | null>("/admin/dashboard-message")
      .then((mensajeRes) => setMensaje(mensajeRes?.texto ?? null));
    refrescarDatos();
  }

  useEffect(() => {
    cargar();
  }, []);

  const ocultas = usuario?.bibliotecasOcultas ?? [];
  const disponibilidadVisible = (disponibilidad ?? []).filter((d) => !ocultas.includes(d.bibliotecaId));
  const bibliotecasVisibles = bibliotecas.filter((b) => !ocultas.includes(b.id));

  // Estado conjunto de reservas + ocupación; la fecha mostrada es la del dato más antiguo.
  const fechas = [fuentes.reservas.actualizadoEn, fuentes.disponibilidad.actualizadoEn].filter(
    (f): f is string => f !== null,
  );
  const masAntiguo = fechas.length === 2 ? (fechas[0] < fechas[1] ? fechas[0] : fechas[1]) : null;
  const estadoDatos: EstadoFrescura =
    fuentes.reservas.cargando || fuentes.disponibilidad.cargando
      ? "actualizando"
      : fuentes.reservas.error ||
          fuentes.disponibilidad.error ||
          !masAntiguo ||
          ahora - new Date(masAntiguo).getTime() > ANTIGUEDAD_MAX_MS
        ? "desactualizado"
        : "actualizado";

  return (
    <Fragment>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-1.5">
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Dashboard</h1>
          {/* Estado de los datos (reservas + ocupación). */}
          <DataFreshness estado={estadoDatos} actualizadoEn={masAntiguo} ahora={ahora} onRefrescar={refrescarDatos} />
        </div>
        <CurrentDateTime />
      </div>

      {/* Todos los controles de la página en una sola franja: pestañas, avisos (como
          desplegables compactos en vez de recuadros siempre abiertos) y el botón de
          reserva a la derecha. En móvil, lo que no cabe baja a la siguiente línea
          (flex-wrap) en vez de amontonarse. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 ${
                  tab === t.id
                    ? "bg-white font-medium shadow dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>


          {mensaje && (
            <Dropdown
              label="Aviso ▾"
              buttonClassName="whitespace-nowrap rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-900/60 dark:bg-brand-900/20 dark:text-brand-300 dark:hover:bg-brand-900/40"
              panelClassName="w-72 max-w-[90vw] border-brand-200 text-brand-900 dark:border-brand-900/60 dark:text-brand-200"
            >
              {mensaje}
            </Dropdown>
          )}

          {horarios.length > 0 && (
            <Dropdown
              label="Horarios extraordinarios ▾"
              buttonClassName="whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40"
              panelClassName="w-80 max-w-[90vw] space-y-3 border-amber-200 text-amber-900 dark:border-amber-900/60 dark:text-amber-200"
            >
              {horarios.map((h) => (
                <MiniMarkdown key={h.id} texto={h.texto} />
              ))}
            </Dropdown>
          )}

          <FailedReservationsNotice />
        </div>

        {tab === "general" && (
          <button
            onClick={() => setWizardOpen(true)}
            disabled={vistaTodas}
            title={vistaTodas ? "Elige una cuenta concreta para reservar" : undefined}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hacer una reserva
          </button>
        )}
      </div>

      {tab === "general" && (
        <div className="space-y-8">
          {/* 3 bloques: en curso / próximas arriba una al lado de la otra en escritorio, y
              ocupación abajo ocupando todo el ancho. En móvil (grid-cols-1) se apilan en
              ese mismo orden, así lo primero que se ve son las reservas actuales y luego
              el estado de las bibliotecas. */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {errorReservas && (
              <p className="lg:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                No se han podido consultar tus reservas en PatronBase: {errorReservas}
              </p>
            )}
            <ReservationsList titulo="En curso" reservas={reservas.enCurso} vacio="No tienes reservas en curso" />
            <ReservationsList titulo="Próximas" reservas={reservas.proximas} vacio="No tienes próximas reservas" />

            <div className="lg:col-span-2">
              <NextAttempts />
            </div>

            <div className="lg:col-span-2">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Ocupación de las bibliotecas
              </h2>
              {disponibilidad === null ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">Consultando disponibilidad en PatronBase…</p>
              ) : disponibilidadVisible.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  Has ocultado todas las bibliotecas.{" "}
                  <Link to="/cuenta" className="text-brand-600 hover:underline dark:text-brand-400">
                    Cambia cuáles ver desde Cuenta
                  </Link>
                  .
                </p>
              ) : (
                // auto-fit en vez de un nº fijo de columnas: si ocultas bibliotecas desde
                // Cuenta, las tarjetas restantes se reparten el espacio libre en vez de
                // dejarlo vacío.
                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                  {disponibilidadVisible.map((d) => (
                    <AvailabilityBadge key={d.bibliotecaId} disponibilidad={d} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "planos" && <FloorPlans />}
    </div>

      {wizardOpen && (
        <BookingWizard
          bibliotecas={bibliotecasVisibles}
          onClose={() => setWizardOpen(false)}
          onCreated={() => {
            setWizardOpen(false);
            cargar();
          }}
        />
      )}
    </Fragment>
  );
}
