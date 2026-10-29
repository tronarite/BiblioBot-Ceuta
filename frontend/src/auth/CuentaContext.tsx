import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setCuentaActiva } from "../api/client";
import type { CuentaPatronBase } from "../api/types";
import { useAuth } from "./AuthContext";

type CuentaState = {
  cuentas: CuentaPatronBase[];
  cuentaActiva: CuentaPatronBase | null;
  cuentaActivaId: string | null;
  cargada: boolean;
  seleccionar: (id: string) => void;
  recargar: () => Promise<void>;
};

const CuentaContext = createContext<CuentaState | null>(null);
const CLAVE = "bibliobot:cuentaActiva";

function leerGuardada(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function CuentaProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [cuentas, setCuentas] = useState<CuentaPatronBase[]>([]);
  const [activaId, setActivaId] = useState<string | null>(leerGuardada);
  const [cargada, setCargada] = useState(false);

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
  const cuentaActiva = useMemo(
    () => cuentas.find((c) => c.id === activaId) ?? cuentas.find((c) => c.principal) ?? cuentas[0] ?? null,
    [cuentas, activaId],
  );
  const cuentaActivaId = cuentaActiva?.id ?? null;

  // Síncrono en render para que las peticiones de los hijos ya lleven la cabecera.
  setCuentaActiva(cuentaActivaId);

  const seleccionar = useCallback((id: string) => {
    setActivaId(id);
    try {
      localStorage.setItem(CLAVE, id);
    } catch {
      /* sin persistencia, no pasa nada */
    }
  }, []);

  return (
    <CuentaContext.Provider value={{ cuentas, cuentaActiva, cuentaActivaId, cargada, seleccionar, recargar }}>
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
