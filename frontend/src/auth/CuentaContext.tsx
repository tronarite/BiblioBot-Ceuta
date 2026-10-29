import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setCuentaActiva } from "../api/client";
import type { CuentaPatronBase } from "../api/types";
import { useAuth } from "./AuthContext";

type CuentaState = {
  cuentas: CuentaPatronBase[];
  cuentaActiva: CuentaPatronBase | null;
  cuentaActivaId: string | null;
  /** Vista temporal "ver todas": solo lectura, junta reservas y programaciones de todas las cuentas. */
  vistaTodas: boolean;
  alternarTodas: () => void;
  /** Identifica la vista actual ("todas" o el id de la cuenta); sirve de key y de clave de caché. */
  claveVista: string | null;
  cargada: boolean;
  seleccionar: (id: string) => void;
  recargar: () => Promise<void>;
};

const CuentaContext = createContext<CuentaState | null>(null);
const CLAVE = "bibliobot:cuentaActiva";
export const VISTA_TODAS = "todas";

const CLAVE_TODAS = "bibliobot:vistaTodas";

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* sin persistencia, no pasa nada */
  }
}

function leerGuardada(): string | null {
  const guardada = leer(CLAVE);
  return guardada === VISTA_TODAS ? null : guardada;
}

export function CuentaProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [cuentas, setCuentas] = useState<CuentaPatronBase[]>([]);
  const [activaId, setActivaId] = useState<string | null>(leerGuardada);
  const [cargada, setCargada] = useState(false);
  // Vista "Todas las cuentas": se recuerda al recargar, igual que la cuenta elegida.
  const [verTodas, setVerTodas] = useState(() => leer(CLAVE_TODAS) === "1");

  const recargar = useCallback(async () => {
    if (!usuario) {
      setCuentas([]);
      setCargada(false);
      return;
    }
    const lista = await api.get<CuentaPatronBase[]>("/account/patronbase/cuentas");
    setCuentas(lista);
    setCargada(true);
  }, [usuario?.id]);

  useEffect(() => {
    recargar().catch(() => setCargada(true));
  }, [recargar]);

  // Si la guardada ya no existe (o no hay ninguna), se usa la principal.
  // En la vista "todas" la cuenta activa es la principal (para lo que necesita una real), pero
  // solo si hay varias cuentas: con una sola no hay nada que juntar.
  const vistaTodas = verTodas && cuentas.length > 1;
  const cuentaActiva = useMemo(
    () =>
      (vistaTodas ? null : cuentas.find((c) => c.id === activaId)) ?? cuentas.find((c) => c.principal) ?? cuentas[0] ?? null,
    [cuentas, activaId, vistaTodas],
  );
  const cuentaActivaId = cuentaActiva?.id ?? null;
  const claveVista = vistaTodas ? VISTA_TODAS : cuentaActivaId;

  // Síncrono en render para que las peticiones de los hijos ya lleven la cabecera.
  setCuentaActiva(claveVista);

  const alternarTodas = useCallback(() => {
    const siguiente = !verTodas;
    setVerTodas(siguiente);
    guardar(CLAVE_TODAS, siguiente ? "1" : "0");
  }, [verTodas]);

  const seleccionar = useCallback((id: string) => {
    setVerTodas(false);
    setActivaId(id);
    guardar(CLAVE, id);
    guardar(CLAVE_TODAS, "0");
  }, []);

  return (
    <CuentaContext.Provider value={{ cuentas, cuentaActiva, cuentaActivaId, vistaTodas, alternarTodas, claveVista, cargada, seleccionar, recargar }}>
      {children}
    </CuentaContext.Provider>
  );
}

export function useCuentas() {
  const ctx = useContext(CuentaContext);
  if (!ctx) throw new Error("useCuentas fuera de CuentaProvider");
  return ctx;
}

export const nombreCuenta = (c: Pick<CuentaPatronBase, "alias" | "patronbaseEmail">) => c.alias || c.patronbaseEmail;
