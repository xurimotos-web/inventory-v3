import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionsProvider } from './context/PermissionsContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import InsumosPage from './pages/insumos/InsumosPage';
import EntradasPage from './pages/entradas/EntradasPage';
import SalidasPage from './pages/salidas/SalidasPage';
import AlertasPage from './pages/alertas/AlertasPage';
import AlertasMisInsumosPage from './pages/alertas/AlertasMisInsumosPage';
import AlertasUsuariosPage from './pages/alertas-usuarios/AlertasUsuariosPage';
import ReportesPage from './pages/reportes/ReportesPage';
import UsuariosPage from './pages/usuarios/UsuariosPage';
import ConfiguracionPage from './pages/configuracion/ConfiguracionPage';
import AsignacionesPage from './pages/asignaciones/AsignacionesPage';
import ProveedoresPage from './pages/proveedores/ProveedoresPage';
import RotacionPage from './pages/rotacion/RotacionPage';
import { PageLoader } from './components/shared/LoadingSpinner';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAdmin) return <Navigate to="/salidas" replace />;
  return <>{children}</>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><PageLoader /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function SmartAlertas() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AlertasPage /> : <AlertasMisInsumosPage />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><PageLoader /></div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="insumos" element={<InsumosPage />} />
        <Route path="entradas" element={<AdminRoute><EntradasPage /></AdminRoute>} />
        <Route path="salidas" element={<SalidasPage />} />
        <Route path="alertas-usuarios" element={<AdminRoute><AlertasUsuariosPage /></AdminRoute>} />
        <Route path="alertas" element={<PrivateRoute><SmartAlertas /></PrivateRoute>} />
        <Route path="asignaciones" element={<AdminRoute><AsignacionesPage /></AdminRoute>} />
        <Route path="proveedores" element={<AdminRoute><ProveedoresPage /></AdminRoute>} />
        <Route path="rotacion" element={<AdminRoute><RotacionPage /></AdminRoute>} />
        <Route path="reportes" element={<PrivateRoute><ReportesPage /></PrivateRoute>} />
        <Route path="usuarios" element={<AdminRoute><UsuariosPage /></AdminRoute>} />
        <Route path="configuracion" element={<AdminRoute><ConfiguracionPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PermissionsProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '12px',
              background: '#1e293b',
              color: '#f8fafc',
              fontSize: '13px',
              padding: '10px 16px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#f8fafc' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#f8fafc' } },
          }}
        />
      </BrowserRouter>
      </PermissionsProvider>
    </AuthProvider>
  );
}
