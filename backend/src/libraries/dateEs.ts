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

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
