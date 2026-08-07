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

/** Convierte una etiqueta de día en español ("viernes, 7 de agosto") en un Date real. */
export function parseSpanishDateLabel(label: string): Date | null {
  const normalized = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const match = normalized.match(/(\d{1,2})\s+de\s+([a-z]{3,})/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MESES[match[2].slice(0, 3)];
  if (month === undefined) return null;

  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month, day);
  // Si la fecha calculada queda muy en el pasado, probablemente cruzamos año (dic -> ene).
  if (candidate.getTime() < now.getTime() - 1000 * 60 * 60 * 24 * 30) {
    year += 1;
  }
  return new Date(year, month, day);
}
