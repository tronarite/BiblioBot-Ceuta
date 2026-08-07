import { env } from "../env";

/**
 * PatronBase es una app clásica server-rendered (formularios GET/POST + un par de
 * endpoints AJAX puntuales), no una SPA. En vez de un navegador headless nos basta con
 * un cliente HTTP que mantenga cookies de sesión entre peticiones.
 */
export class PatronBaseSession {
  private cookies = new Map<string, string>();

  private cookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  private captureCookies(res: Response) {
    const setCookieHeader = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.();
    const raw = setCookieHeader ?? [];
    for (const line of raw) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      this.cookies.set(name, value);
    }
  }

  async request(
    path: string,
    init: { method?: string; body?: URLSearchParams; redirect?: "follow" | "manual" } = {},
  ): Promise<{ status: number; url: string; text: string }> {
    const url = path.startsWith("http") ? path : `${env.patronbaseBaseUrl}${path}`;
    const headers: Record<string, string> = {
      Cookie: this.cookieHeader(),
      "User-Agent": "BiblioBot/1.0 (+cita previa automatizada; uso personal del titular de la cuenta)",
    };
    if (init.body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers,
      body: init.body,
      redirect: init.redirect ?? "follow",
    });
    this.captureCookies(res);
    const text = await res.text();
    return { status: res.status, url: res.url, text };
  }

  async get(path: string) {
    return this.request(path, { method: "GET" });
  }

  async post(path: string, body: URLSearchParams, redirect: "follow" | "manual" = "follow") {
    return this.request(path, { method: "POST", body, redirect });
  }
}
