import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute() {
  const { usuario, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const { usuario, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.rol !== "admin") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
