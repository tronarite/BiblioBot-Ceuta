import cron from "node-cron";
import { prisma } from "../db";
import { getPerformances, listProductions } from "../patronbase/adapter";
import { PatronBaseSession } from "../patronbase/session";

/**
 * Comprobación automática de que el scraping de PatronBase sigue funcionando. Solo usa
 * peticiones públicas (sin login). Si PatronBase cambia el HTML, los selectores de
 * cheerio dejan de encontrar nada y esto lo detecta antes de que fallen las reservas
 * reales. El resultado se guarda en EstadoScraper (fila única) y se muestra en el panel
 * de administración.
 */
export async function comprobarScraper(): Promise<{ ok: boolean; detalle: string }> {
  let resultado: { ok: boolean; detalle: string };
  try {
    const session = new PatronBaseSession();
    const producciones = await listProductions(session);
    if (producciones.length < 3 || producciones.some((p) => !p.prodId || !p.title)) {
      resultado = {
        ok: false,
        detalle: `El listado de producciones devolvió ${producciones.length} entradas (esperado ≥3). Puede que PatronBase haya cambiado el HTML.`,
      };
    } else {
      const turno = await prisma.turno.findFirst();
      if (!turno) {
        resultado = { ok: true, detalle: `Listado de producciones OK (${producciones.length}). Sin turnos que comprobar.` };
      } else {
        const perf = await getPerformances(session, turno.patronbaseProdId);
        const parseaDias = perf.options.length > 0 || perf.noDisponibleTexto !== null;
        resultado = parseaDias
          ? { ok: true, detalle: `OK: ${producciones.length} producciones, la página de días de un turno también parsea bien.` }
          : {
              ok: false,
              detalle: "La página de días de un turno no devolvió ni opciones ni aviso de 'no disponible'. Posible cambio de HTML.",
            };
      }
    }
  } catch (err) {
    resultado = { ok: false, detalle: `Error al consultar PatronBase: ${(err as Error).message}` };
  }

  await prisma.estadoScraper.upsert({
    where: { id: "scraper" },
    update: { ok: resultado.ok, detalle: resultado.detalle, comprobadoEn: new Date() },
    create: { id: "scraper", ok: resultado.ok, detalle: resultado.detalle, comprobadoEn: new Date() },
  });
  return resultado;
}

export function startScraperMonitor() {
  // Primera comprobación a los 30 s del arranque (deja que el servidor termine de subir).
  setTimeout(() => {
    comprobarScraper().catch(() => {});
  }, 30_000);
  // Y luego cada 30 min.
  cron.schedule("*/30 * * * *", () => {
    comprobarScraper().catch(() => {});
  });
}
