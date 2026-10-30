import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { CuentaProvider } from "./auth/CuentaContext";
import { LoginPage } from "./auth/LoginPage";
import { RegistroPage } from "./auth/RegistroPage";
import { AdminRoute, ProtectedRoute } from "./auth/ProtectedRoute";
import { AppLayout } from "./layout/AppLayout";
import { DashboardPage } from "./pages/Dashboard";
import { ProgramacionesPage } from "./pages/Programaciones";
import { AmigosPage } from "./pages/Amigos";
import { CuentaPage } from "./pages/Cuenta";
import { AdministracionPage } from "./pages/Cuenta/Administracion";
import { ThemeProvider } from "./theme/ThemeContext";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CuentaProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro/:codigo" element={<RegistroPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/programaciones" element={<ProgramacionesPage />} />
              <Route path="/amigos" element={<AmigosPage />} />
              <Route path="/cuenta" element={<CuentaPage />} />
              <Route element={<AdminRoute />}>
                <Route path="/cuenta/administracion" element={<AdministracionPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </CuentaProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
