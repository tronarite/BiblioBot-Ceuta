import * as cheerio from "cheerio";
import { PatronBaseSession } from "./session";

export type ProductionSummary = {
  prodId: string;
  title: string;
  venue: string;
  priceText: string;
};

export type PerformanceOption = {
  perfId: string;
  label: string;
  available: boolean;
  availableFromText?: string;
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

export type CartSummary = {
  isEmpty: boolean;
  itemsText: string[];
  total: string | null;
  checkoutAction: { method: "GET" | "POST"; href: string; fields?: Record<string, string> } | null;
  emptyCartHref: string | null;
  remainingTime: string | null;
};

export type SaleHistoryItem = {
  saleId: string;
  fecha: string;
  informacion: string;
  total: string;
};

// Devuelve una URL absoluta completa (con esquema+host) a partir de un href relativo
// tal como aparece en el HTML. PatronBaseSession.request() reenvía tal cual cualquier
// path que empiece por "http", así que esto evita duplicar el prefijo _BibliotecaCeuta
// que ya trae env.patronbaseBaseUrl.
function absolutePath(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function login(session: PatronBaseSession, email: string, password: string): Promise<boolean> {
  const body = new URLSearchParams({
    url: "/Productions",
    login_email: email,
    login_password: password,
  });
  // El POST de login responde con un 302 cuyo Location es una URL rota (le falta el
  // prefijo de la app). No la seguimos: solo nos interesan las cookies de sesión que
  // trae esa respuesta, y verificamos el login con una petición aparte a una ruta válida.
  await session.post("/Login/Login", body, "manual");
  return isLoggedIn(session);
}

export async function isLoggedIn(session: PatronBaseSession): Promise<boolean> {
  const res = await session.get("/Productions");
  return res.text.includes("Desconecta");
}

export async function listProductions(session: PatronBaseSession, category?: string): Promise<ProductionSummary[]> {
  const path = category ? `/Productions?category=${encodeURIComponent(category)}` : "/Productions";
  const res = await session.get(path);
  const $ = cheerio.load(res.text);
  const productions: ProductionSummary[] = [];

  $(".pb_production").each((_, el) => {
    const card = $(el);
    const titleA = card.find(".pb_event_title_a").first();
    const href = titleA.attr("href") ?? "";
    const match = href.match(/\/Productions\/([^/]+)\/Performances/);
    if (!match) return;
    productions.push({
      prodId: match[1],
      title: cleanText(titleA.text()),
      venue: cleanText(card.find(".pb_event_venue .pb_venue").text()),
      priceText: cleanText(card.find(".pb_event_pricing .pb_pricing").text()),
    });
  });

  return productions;
}

export async function getPerformances(session: PatronBaseSession, prodId: string): Promise<PerformanceOption[]> {
  const res = await session.get(`/Productions/${encodeURIComponent(prodId)}/Performances`);
  const $ = cheerio.load(res.text);
  const options: PerformanceOption[] = [];

  $("input[type=radio][name=perf_id]").each((_, el) => {
    const radio = $(el);
    const perfId = radio.attr("value");
    if (!perfId) return;
    const disabled = radio.attr("disabled") !== undefined;

    let container = radio.closest("label");
    if (container.length === 0) container = radio.parent();
    const rawText = cleanText(container.text());

    const match = rawText.match(/No estará disponible hasta[^\n]*/i);

    options.push({
      perfId,
      label: rawText,
      available: !disabled,
      availableFromText: match ? match[0] : undefined,
    });
  });

  return options;
}

export async function getSeatMap(
  session: PatronBaseSession,
  prodId: string,
  perfId: string,
): Promise<SeatMapResult> {
  const res = await session.get(
    `/Sections/Choose?prod_id=${encodeURIComponent(prodId)}&perf_id=${encodeURIComponent(perfId)}`,
  );
  const $ = cheerio.load(res.text);
  const seats: SeatInfo[] = [];

  $(".pb_pyos_seat").each((_, el) => {
    const seatEl = $(el);
    const raw = seatEl.attr("data-attrs");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        section_id: string;
        area_id: string;
        row_id: string;
        seat_id: string;
        seat_type_id: string;
      };
      seats.push({
        seatId: String(parsed.seat_id),
        rowId: String(parsed.row_id),
        areaId: String(parsed.area_id),
        sectionId: String(parsed.section_id),
        seatTypeId: String(parsed.seat_type_id),
        label: seatEl.attr("title") ?? "",
        state: seatEl.attr("data-seat-state") ?? "unknown",
      });
    } catch {
      // Ignora asientos cuyo data-attrs no se pueda parsear.
    }
  });

  const confirmA = $("a")
    .filter((_, el) => cleanText($(el).text()) === "Confirmar Asientos")
    .first();
  const confirmHref = confirmA.length ? absolutePath(res.url, confirmA.attr("href") ?? "") : null;

  return { seats, confirmHref };
}

export async function holdSeat(
  session: PatronBaseSession,
  prodId: string,
  perfId: string,
  seat: Pick<SeatInfo, "sectionId" | "areaId" | "rowId" | "seatId" | "seatTypeId">,
): Promise<boolean> {
  const body = new URLSearchParams({
    section_id: seat.sectionId,
    area_id: seat.areaId,
    row_id: seat.rowId,
    seat_id: seat.seatId,
    seat_type_id: seat.seatTypeId,
    layout: "json",
  });
  const res = await session.post(
    `/Seats/HoldSeat?prod_id=${encodeURIComponent(prodId)}&perf_id=${encodeURIComponent(perfId)}`,
    body,
  );
  if (res.status < 200 || res.status >= 300) return false;
  try {
    // La respuesta real tiene forma {"response":"success","message":null,...}, no
    // {"success": true}.
    const parsed = JSON.parse(res.text) as { response?: string; success?: boolean; error?: string };
    if (typeof parsed.success === "boolean") return parsed.success;
    if (typeof parsed.response === "string") return parsed.response === "success";
    return !parsed.error;
  } catch {
    return false;
  }
}

export async function confirmSeats(session: PatronBaseSession, confirmHref: string): Promise<void> {
  await session.get(confirmHref);
}

export async function getCart(session: PatronBaseSession): Promise<CartSummary> {
  const res = await session.get("/Cart/Show");
  const $ = cheerio.load(res.text);
  const bodyText = $("body").text();

  if (/cesta está vacía/i.test(bodyText)) {
    return { isEmpty: true, itemsText: [], total: null, checkoutAction: null, emptyCartHref: null, remainingTime: null };
  }

  const itemsText: string[] = [];
  $(".pb_cart_item, .pb_basket_item").each((_, el) => {
    itemsText.push(cleanText($(el).text()));
  });

  const totalMatch = bodyText.match(/Total\s*([\d.,]+\s*€)/i);
  const remainingMatch = bodyText.match(/Tiempo restante:\s*([\d:]+)/i);

  const emptyCartA = $("a[href*='RemoveAll']").first();
  const emptyCartHref = emptyCartA.length ? absolutePath(res.url, emptyCartA.attr("href") ?? "") : null;

  // "Completar el Pedido" es siempre un <a href="/Cart/Checkout" class="pb_checkout_now">,
  // no un botón dentro del <form> de código de descuento (que también envuelve ese enlace
  // en el HTML, pero no lo controla).
  let checkoutAction: CartSummary["checkoutAction"] = null;
  const checkoutA = $("a.pb_checkout_now, #checkout_button")
    .filter((_, el) => /Completar el Pedido/i.test($(el).text()))
    .first();
  const checkoutAFallback = checkoutA.length ? checkoutA : $("a").filter((_, el) => /Completar el Pedido/i.test($(el).text())).first();
  if (checkoutAFallback.length) {
    checkoutAction = { method: "GET", href: absolutePath(res.url, checkoutAFallback.attr("href") ?? "") };
  }

  return {
    isEmpty: false,
    itemsText,
    total: totalMatch ? cleanText(totalMatch[1]) : null,
    checkoutAction,
    emptyCartHref,
    remainingTime: remainingMatch ? remainingMatch[1] : null,
  };
}

export async function emptyCart(session: PatronBaseSession, emptyCartHref: string): Promise<void> {
  await session.get(emptyCartHref);
}

/**
 * El "Completar el Pedido" de /Cart/Show solo navega a una página intermedia de
 * confirmación (con checkbox de términos y método de pago "gratis" precargado).
 * Hay que enviar ESE formulario para que el pedido se finalice de verdad.
 */
export async function checkout(session: PatronBaseSession, action: NonNullable<CartSummary["checkoutAction"]>): Promise<string | null> {
  const confirmPage = action.method === "POST"
    ? await session.post(action.href, new URLSearchParams(action.fields ?? {}))
    : await session.get(action.href);

  const $ = cheerio.load(confirmPage.text);
  const form = $("form[action*='Checkout']").first();
  if (!form.length) {
    // Ya podría ser la propia página de recibo si PatronBase cambia el flujo.
    const idMatch = confirmPage.text.match(/Pedido n[ºo]\s*(\d+)/i);
    return idMatch ? idMatch[1] : null;
  }

  const body = new URLSearchParams();
  form.find("input").each((_, el) => {
    const input = $(el);
    const name = input.attr("name");
    if (!name) return;
    body.set(name, input.attr("value") ?? (input.attr("type") === "checkbox" ? "1" : ""));
  });

  const actionUrl = new URL(form.attr("action") ?? "/Cart/Checkout", confirmPage.url).toString();
  const receipt = await session.post(actionUrl, body);
  const idMatch = receipt.text.match(/Pedido n[ºo]\s*(\d+)/i) ?? receipt.text.match(/sale=(\d+)/);
  return idMatch ? idMatch[1] : null;
}

export async function getSalesHistory(session: PatronBaseSession): Promise<SaleHistoryItem[]> {
  const res = await session.get("/Patron/SalesHistory");
  const $ = cheerio.load(res.text);
  const items: SaleHistoryItem[] = [];

  $("a[href*='ViewSale?sale=']").each((_, el) => {
    const link = $(el);
    const href = link.attr("href") ?? "";
    const match = href.match(/sale=(\d+)/);
    if (!match) return;
    const row = link.closest("tr");
    const cells = row.length ? row.find("td") : link.parent();
    const texts = row.length
      ? cells.toArray().map((c) => cleanText($(c).text()))
      : [cleanText(row.text())];

    items.push({
      saleId: match[1],
      fecha: texts[1] ?? "",
      informacion: texts[2] ?? "",
      total: texts[texts.length - 1] ?? "",
    });
  });

  return items;
}

export async function getSaleDetail(session: PatronBaseSession, saleId: string): Promise<Record<string, string>> {
  const res = await session.get(`/Patron/ViewSale?sale=${encodeURIComponent(saleId)}`);
  const $ = cheerio.load(res.text);
  const text = $("body").text();

  const extract = (label: string) => {
    const re = new RegExp(`${label}:\\s*([^\\n]+)`, "i");
    const match = text.match(re);
    return match ? cleanText(match[1]) : "";
  };

  return {
    idVenta: extract("ID de la Venta"),
    fechaVenta: extract("Fecha de la venta"),
    asiento: (text.match(/\(([^)]*Fila[^)]*)\)/i) ?? [, ""])[1],
    total: extract("Total"),
  };
}
