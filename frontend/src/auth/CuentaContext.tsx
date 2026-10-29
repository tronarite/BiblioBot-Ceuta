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

function leerGuardada(): string | null {
  try {
    const guardada = localStorage.getItem(CLAVE);
    return guardada === VISTA_TODAS ? null : guardada;
  } catch {
    return null;
  }
}

export function CuentaProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [cuentas, setCuentas] = useState<CuentaPatronBase[]>([]);
  const [activaId, setActivaId] = useState<string | null>(leerGuardada);
  const [cargada, setCargada] = useState(false);
  // Vista temporal: no se guarda, así al recargar o cambiar de cuenta se vuelve al ajuste de la cuenta.
  const [verTodas, setVerTodas] = useState(false);

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

  const alternarTodas = useCallback(() => setVerTodas((v) => !v), []);

  const seleccionar = useCallback((id: string) => {
    setVerTodas(false);
    setActivaId(id);
    try {
      localStorage.setItem(CLAVE, id);
    } catch {
      /* sin persistencia, no pasa nada */
    }
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
