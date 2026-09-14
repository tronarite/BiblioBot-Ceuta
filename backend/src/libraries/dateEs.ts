const MESES: Record<string, number> = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

/**
 * Comprueba si una etiqueta de día en español (tal como la devuelve PatronBase, ej.
 * "viernes, 7 de agosto") corresponde a una fecha concreta, comparando día+mes.
 */
export function labelMatchesDate(label: string, date: Date): boolean {
  const day = date.getDate();
  const normalized = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  const match = normalized.match(/(\d{1,2})\s+de\s+([a-z]{3,})/);
  if (!match) return false;
  const labelDay = Number(match[1]);
  const monthPrefix = match[2].slice(0, 3);
  const labelMonth = MESES[monthPrefix];
  if (labelMonth === undefined) return false;

  return labelDay === day && labelMonth === date.getMonth();
}

const NOMBRES_MES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const NOMBRES_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "lunes 14 de septiembre" — para mensajes legibles (ej. avisos de reserva fallida). */
export function formatearFechaEs(date: Date): string {
  return `${NOMBRES_DIA[date.getDay()]} ${date.getDate()} de ${NOMBRES_MES[date.getMonth()]}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Parsea una fecha en español completa (con año), en cualquiera de los dos formatos que
 * usa PatronBase: "17 de julio de 2026" (páginas de detalle) o "julio 17 2026"
 * (columna Fecha del historial de compras).
 */
export function parseSpanishDate(text: string): Date | null {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  let match = normalized.match(/(\d{1,2})\s+de\s+([a-z]{3,})\s+de\s+(\d{4})/);
  if (match) {
    const month = MESES[match[2].slice(0, 3)];
    if (month !== undefined) return new Date(Number(match[3]), month, Number(match[1]));
  }

  match = normalized.match(/([a-z]{3,})\s+(\d{1,2})\s+(\d{4})/);
  if (match) {
    const month = MESES[match[1].slice(0, 3)];
    if (month !== undefined) return new Date(Number(match[3]), month, Number(match[2]));
  }

  return null;
}
