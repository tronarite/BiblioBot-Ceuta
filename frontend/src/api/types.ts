export type Rol = "admin" | "usuario";

export type Usuario = {
  id: string;
  nombre: string;
  email: string | null;
  username: string | null;
  rol: Rol;
  activo?: boolean;
  bibliotecasOcultas: string[];
  debeCambiarPassword: boolean;
  patronbaseEstado: "no_vinculada" | "vinculada" | "error";
};

export type Turno = {
  id: string;
  tipo: "manana" | "tarde";
  horario: string;
  patronbaseProdId: string;
};

export type Planta = {
  id: string;
  nombre: string;
  reglasEspeciales: string | null;
  turnos: Turno[];
};

export type Biblioteca = {
  id: string;
  nombre: string;
  patronbaseCodigo: string;
  reglasEspeciales: string | null;
  plantas: Planta[];
};

export type EstadoDisponibilidad =
  | "disponible_hoy_manana"
  | "disponible_solo_hoy"
  | "disponible_solo_manana"
  | "no_disponible";

export type DisponibilidadBiblioteca = {
  bibliotecaId: string;
  nombre: string;
  estado: EstadoDisponibilidad;
  proximoDiaDisponibleTexto?: string;
};

// Respuesta de los endpoints con caché stale-while-revalidate (disponibilidad general,
// estado de turnos): "items" puede venir de una consulta anterior a PatronBase en vez de
// recién scrapeada; "actualizando" indica que el servidor está refrescándola en segundo
// plano en este mismo momento.
export type ConCache<T> = {
  items: T;
  actualizadoEn: string;
  actualizando: boolean;
};

export type PerformanceOption = {
  perfId: string;
  label: string;
  available: boolean;
  availableFromText?: string;
};

export type PerformancesResponse = {
  options: PerformanceOption[];
  noDisponibleTexto: string | null;
};

export type EstadoTurno = {
  turnoId: string;
  disponibleAhora: boolean;
  mensaje: string | null;
  plazasLibresHoy: number | null;
  avisoPlazasHoy: "pocas" | "criticas" | null;
};

export type SeatInfo = {
  seatId: string;
  rowId: string;
  areaId: string;
  sectionId: string;
  seatTypeId: string;
  label: string;
  state: string;
};

export type SeatMapResult = {
  seats: SeatInfo[];
  confirmHref: string | null;
};

export type ReservaPatronBase = {
  saleId: string;
  bibliotecaNombre: string;
  plantaNombre: string;
  turnoTipo: "manana" | "tarde" | null;
  horario: string | null;
  fecha: string;
  horaSesion: string;
  asiento: string;
  estado: "en_curso" | "proxima";
  enlacePatronBase: string;
};

export type ReservationsResponse = {
  enCurso: ReservaPatronBase[];
  proximas: ReservaPatronBase[];
};

export type Programacion = {
  id: string;
  nombre: string | null;
  bibliotecaId: string;
  plantaId: string;
  turnos: string;
  tipo: "n_reservas" | "hasta_fecha" | "indefinida";
  valorTipoNumero: number | null;
  valorTipoFecha: string | null;
  diasSemana: string;
  asientosCodigos: string; // JSON array ordenado por preferencia
  estado: "activa" | "pausada" | "finalizada";
  contadorReservasRealizadas: number;
  proximaEjecucion: string | null;
  biblioteca: Biblioteca;
  planta: Planta;
};

export type EstadoSistema = {
  scraper: { ok: boolean; detalle: string; comprobadoEn: string } | null;
  cuentasPatronBase: { no_vinculada: number; vinculada: number; error: number };
  programacionesActivas: number;
};

export type AdminProgramacion = Programacion & {
  usuario: { nombre: string; email: string | null; username: string | null };
};

export type AdminActividad = {
  id: string;
  tipoEvento: string;
  mensaje: string;
  fecha: string;
  usuario: { nombre: string } | null;
  programacion: { nombre: string | null } | null;
};

export type ActividadLog = {
  id: string;
  tipoEvento: string;
  mensaje: string;
  fecha: string;
  programacionId: string | null;
};

export type HorarioExtraordinario = {
  id: string;
  texto: string;
  createdAt: string;
};

export type CuentaPatronBaseStatus = {
  estadoVinculacion: "no_vinculada" | "vinculada" | "error";
  patronbaseEmail: string | null;
};
