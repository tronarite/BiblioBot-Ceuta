import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "bibliobot-theme";
// Marca aparte de si el tema guardado viene de una elección manual (botón) o no.
// Necesaria porque versiones anteriores escribían STORAGE_KEY en cada carga aunque el
// usuario no hubiera tocado nada — sin esta marca, cualquiera que ya hubiera abierto
// la app antes se quedaría "atascado" en modo manual para siempre y nunca seguiría al
// sistema en vivo.
const MANUAL_KEY = "bibliobot-theme-manual";

function prefiereOscuro(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function esManual(): boolean {
  return localStorage.getItem(MANUAL_KEY) === "1";
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (esManual() && (stored === "light" || stored === "dark")) return stored;
  return prefiereOscuro() ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

type ThemeState = {
  theme: Theme;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  // Si el usuario ya eligió un tema a mano, los cambios del sistema dejan de pisarlo.
  const elegidoAMano = useRef(esManual());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange(e: MediaQueryListEvent) {
      if (elegidoAMano.current) return;
      setTheme(e.matches ? "dark" : "light");
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      elegidoAMano.current = true;
      localStorage.setItem(STORAGE_KEY, next);
      localStorage.setItem(MANUAL_KEY, "1");
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}
