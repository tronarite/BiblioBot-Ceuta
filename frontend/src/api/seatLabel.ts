const CONECTORES = new Set(["de", "del", "la", "las", "los", "y"]);

function tituloEs(texto: string): string {
  return texto
    .toLowerCase()
    .split(" ")
    .map((palabra, i) => (i > 0 && CONECTORES.has(palabra) ? palabra : palabra.charAt(0).toUpperCase() + palabra.slice(1)))
    .join(" ");
}

export type AsientoParseado = {
  tipo: string;
  numero: string;
};

/**
 * PatronBase etiqueta cada asiento como "{SALA} Fila {F} - Asiento {N}" (el nombre de sala
 * es el tipo de puesto: SALA GENERAL, SALA DE ESTUDIOS, SALA DE INVESTIGACIÓN...). La fila
 * es en realidad la planta (ver coincideAsiento en el backend), así que no aporta nada
 * mostrarla: se descompone la etiqueta en sus dos datos útiles, tipo de asiento y número.
 */
export function parseAsiento(label: string): AsientoParseado | null {
  const match = label.match(/^(.*?)\s*fila\s*\d+\s*[-,]?\s*asiento\s*(\d+)/i);
  if (!match || !match[1].trim()) return null;
  return { tipo: tituloEs(match[1].trim()), numero: match[2] };
}

/** Versión en una sola línea, para sitios donde no hay espacio para dos datos separados. */
export function formatearAsiento(label: string): string {
  const parsed = parseAsiento(label);
  return parsed ? `${parsed.tipo} · Asiento ${parsed.numero}` : label;
}
