type PlantaConReglas = { nombre: string; reglasEspeciales: string | null };
type BibliotecaConReglas = { reglasEspeciales: string | null };

/**
 * Reglas de negocio de §5.3 de BiblioBot_Especificacion_Interfaz.md:
 * - Adolfo Suárez: sin reservas sábado tarde ni domingo (ningún turno).
 * - Cualquier planta 5ª: cerrada sábado por la mañana.
 * Se validan tanto al construir el formulario (frontend deshabilita opciones) como aquí,
 * de forma defensiva, justo antes de cada intento real del motor.
 */
export function diaTurnoPermitido(params: {
  biblioteca: BibliotecaConReglas;
  planta: PlantaConReglas;
  turnoTipo: "manana" | "tarde";
  diaSemana: number; // 0=domingo … 6=sábado
}): { permitido: boolean; motivo?: string } {
  const reglasBiblioteca = params.biblioteca.reglasEspeciales ? JSON.parse(params.biblioteca.reglasEspeciales) : {};
  const reglasPlanta = params.planta.reglasEspeciales ? JSON.parse(params.planta.reglasEspeciales) : {};

  if (reglasBiblioteca.sinReservaDomingo && params.diaSemana === 0) {
    return { permitido: false, motivo: "Esta biblioteca no admite reservas los domingos" };
  }
  if (reglasBiblioteca.sinReservaSabadoTarde && params.diaSemana === 6 && params.turnoTipo === "tarde") {
    return { permitido: false, motivo: "Esta biblioteca no admite reservas los sábados por la tarde" };
  }
  if (reglasPlanta.cerradaSabadoManana && params.diaSemana === 6 && params.turnoTipo === "manana") {
    return { permitido: false, motivo: `${params.planta.nombre} está cerrada los sábados por la mañana` };
  }

  return { permitido: true };
}
