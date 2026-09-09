import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Biblioteca, ConCache, DisponibilidadBiblioteca, HorarioExtraordinario, ReservationsResponse } from "../../api/types";
import { AvailabilityBadge } from "../../components/AvailabilityBadge";
import { BookingWizard } from "./BookingWizard";
import { ExtraordinaryBanner } from "./ExtraordinaryBanner";
import { FloorPlans } from "./FloorPlans";
import { ReservationsList } from "./ReservationsList";

const TABS = [
  { id: "general", label: "General" },
  { id: "planos", label: "Planos de las salas" },
] as const;

export function DashboardPage() {
  const { usuario } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("general");
  const [bibliotecas, setBibliotecas] = useState<Biblioteca[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadBiblioteca[] | null>(null);
  const [reservas, setReservas] = useState<ReservationsResponse>({ enCurso: [], proximas: [] });
  const [horarios, setHorarios] = useState<HorarioExtraordinario[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  async function cargar() {
    const [libs, reservasRes, horariosRes, mensajeRes] = await Promise.all([
      api.get<Biblioteca[]>("/libraries"),
      api.get<ReservationsResponse>("/reservations"),
      api.get<HorarioExtraordinario[]>("/admin/horarios-extraordinarios"),
      api.get<{ texto: string } | null>("/admin/dashboard-message"),
    ]);
    setBibliotecas(libs);
    setReservas(reservasRes);
    setHorarios(horariosRes);
    setMensaje(mensajeRes?.texto ?? null);
    cargarDisponibilidad();
  }

  function cargarDisponibilidad() {
    api
      .get<ConCache<DisponibilidadBiblioteca[]>>("/libraries/disponibilidad")
      .then((res) => {
        setDisponibilidad(res.items);
        if (res.actualizando) {
          // Se sirvió una versión en caché algo desactualizada mientras el servidor la
          // refresca en segundo plano; se vuelve a pedir una vez para reflejar el cambio
          // (si lo hay) sin que haga falta recargar la página a mano.
          setTimeout(() => {
            api
              .get<ConCache<DisponibilidadBiblioteca[]>>("/libraries/disponibilidad")
              .then((r) => setDisponibilidad(r.items))
              .catch(() => {});
          }, 4000);
        }
      })
      .catch(() => setDisponibilidad((prev) => prev ?? []));
  }

  useEffect(() => {
    cargar();
  }, []);

  const ocultas = usuario?.bibliotecasOcultas ?? [];
  const disponibilidadVisible = (disponibilidad ?? []).filter((d) => !ocultas.includes(d.bibliotecaId));
  const bibliotecasVisibles = bibliotecas.filter((b) => !ocultas.includes(b.id));

  return (
    <Fragment>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Dashboard</h1>
        {tab === "general" && (
          <button
            onClick={() => setWizardOpen(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Hacer una reserva
          </button>
        )}
      </div>

      {/* Las pestañas dejaban todo el ancho a su derecha vacío; ahora los avisos (mensaje
          del dashboard, horarios extraordinarios) aprovechan ese hueco justo a continuación
          en vez de ocupar una franja aparte a todo lo ancho más abajo. Se pegan a las
          pestañas (no al borde derecho) para no quedar bajo el botón "Hacer una reserva"
          de la fila de arriba. En móvil, al no caber, bajan debajo de las pestañas de forma
          natural (flex-wrap). */}
      <div className="flex flex-wrap items-start gap-3">
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
          <div className="w-fit max-w-full rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-brand-900/60 dark:bg-brand-900/20 dark:text-brand-200 sm:max-w-xs">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              Aviso
            </h2>
            {mensaje}
          </div>
        )}
        <ExtraordinaryBanner horarios={horarios} />
      </div>

      {tab === "general" && (
        <div className="space-y-8">
          {/* 3 bloques: en curso / próximas arriba una al lado de la otra en escritorio, y
              ocupación abajo ocupando todo el ancho. En móvil (grid-cols-1) se apilan en
              ese mismo orden, así lo primero que se ve son las reservas actuales y luego
              el estado de las bibliotecas. */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <ReservationsList titulo="En curso" reservas={reservas.enCurso} vacio="No tienes reservas en curso" />
            <ReservationsList titulo="Próximas" reservas={reservas.proximas} vacio="No tienes próximas reservas" />

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
