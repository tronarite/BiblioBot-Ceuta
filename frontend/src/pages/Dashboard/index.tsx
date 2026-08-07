import { Fragment, useEffect, useState } from "react";
import { api } from "../../api/client";
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

  return (
    <Fragment>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
        {tab === "general" && (
          <button
            onClick={() => setWizardOpen(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Hacer una reserva
          </button>
        )}
      </div>

      <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 ${tab === t.id ? "bg-white font-medium shadow" : "text-slate-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="space-y-8">
          {mensaje && <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">{mensaje}</div>}

          <ExtraordinaryBanner horarios={horarios} />

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Ocupación de las bibliotecas</h2>
            {disponibilidad === null ? (
              <p className="text-sm text-slate-400">Consultando disponibilidad en PatronBase…</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {disponibilidad.map((d) => (
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
