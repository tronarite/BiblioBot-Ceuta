import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import { borrarLocalConPrefijo } from "../api/localCache";
import type { Usuario } from "../api/types";

type AuthState = {
  usuario: Usuario | null;
  loading: boolean;
  adminExists: boolean | null;
  login: (identificador: string, password: string) => Promise<void>;
  bootstrapAdmin: (nombre: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const status = await api.get<{ adminExists: boolean }>("/auth/status");
      setAdminExists(status.adminExists);
      if (status.adminExists) {
        try {
          const me = await api.get<Usuario>("/auth/me");
          setUsuario(me);
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            setUsuario(null);
          } else {
            throw err;
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (identificador: string, password: string) => {
    const me = await api.post<Usuario>("/auth/login", { identificador, password });
    setUsuario(me);
  }, []);

  const bootstrapAdmin = useCallback(async (nombre: string, email: string, password: string) => {
    const me = await api.post<Usuario>("/auth/bootstrap-admin", { nombre, email, password });
    setUsuario(me);
    setAdminExists(true);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    borrarLocalConPrefijo("dash:");
    setUsuario(null);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, loading, adminExists, login, bootstrapAdmin, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
