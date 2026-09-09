import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Biblioteca, DisponibilidadBiblioteca, HorarioExtraordinario, ReservationsResponse } from "../../api/types";
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

    api
      .get<DisponibilidadBiblioteca[]>("/libraries/disponibilidad")
      .then(setDisponibilidad)
      .catch(() => setDisponibilidad([]));
  }

  useEffect(() => {
    cargar();
  }, []);

  const ocultas = usuario?.bibliotecasOcultas ?? [];
  const disponibilidadVisible = (disponibilidad ?? []).filter((d) => !ocultas.includes(d.bibliotecaId));

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

      {tab === "general" && (
        <div className="space-y-8">
          {mensaje && (
            <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
              {mensaje}
            </div>
          )}

          <ExtraordinaryBanner horarios={horarios} />

          <div>
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
              // auto-fit en vez de un nº fijo de columnas: si ocultas bibliotecas desde Cuenta,
              // las tarjetas restantes se reparten el espacio libre en vez de dejarlo vacío,
              // tanto en móvil como en escritorio.
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                {disponibilidadVisible.map((d) => (
                  <AvailabilityBadge key={d.bibliotecaId} disponibilidad={d} />
                ))}
              </div>
            )}
          </div>

          <ReservationsList titulo="En curso" reservas={reservas.enCurso} vacio="No tienes reservas en curso" />
          <ReservationsList titulo="Próximas" reservas={reservas.proximas} vacio="No tienes próximas reservas" />
        </div>
      )}

      {tab === "planos" && <FloorPlans />}
    </div>

      {wizardOpen && (
        <BookingWizard
          bibliotecas={bibliotecas}
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
