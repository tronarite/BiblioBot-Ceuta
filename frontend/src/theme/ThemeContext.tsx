import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Modo = "light" | "dark" | "auto";
type Theme = "light" | "dark";

const STORAGE_KEY = "bibliobot-theme-modo";
// Claves de una versión anterior (sin botón de "auto" explícito): se migran una vez y
// ya no se vuelven a escribir.
const LEGACY_THEME_KEY = "bibliobot-theme";
const LEGACY_MANUAL_KEY = "bibliobot-theme-manual";

function prefiereOscuro(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolver(modo: Modo): Theme {
  return modo === "auto" ? (prefiereOscuro() ? "dark" : "light") : modo;
}

function getInitialModo(): Modo {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "auto") return stored;

  // Migración desde el sistema anterior: si el usuario ya había elegido tema a mano,
  // se respeta esa elección; si no, pasa a "auto" (antes era el comportamiento
  // implícito por defecto, ahora es una opción explícita).
  const legacyManual = localStorage.getItem(LEGACY_MANUAL_KEY) === "1";
  const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY);
  if (legacyManual && (legacyTheme === "light" || legacyTheme === "dark")) return legacyTheme;

  return "auto";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

type ThemeState = {
  modo: Modo;
  theme: Theme;
  setModo: (modo: Modo) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [modo, setModoState] = useState<Modo>(getInitialModo);
  const [theme, setTheme] = useState<Theme>(() => resolver(modo));

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    setTheme(resolver(modo));
    if (modo !== "auto") return;

    // En modo "auto" el tema sigue al sistema en vivo, incluido un cambio de este
    // mientras la pestaña sigue abierta (ej. el modo oscuro automático del móvil al
    // anochecer).
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange(e: MediaQueryListEvent) {
      setTheme(e.matches ? "dark" : "light");
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [modo]);

  function setModo(nuevo: Modo) {
    setModoState(nuevo);
    localStorage.setItem(STORAGE_KEY, nuevo);
  }

  return <ThemeContext.Provider value={{ modo, theme, setModo }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}
