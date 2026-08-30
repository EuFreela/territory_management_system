import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import RequirePermission from './components/RequirePermission';
import ScrollToTop from './components/ui/ScrollToTop';
import { LoadingScreen } from './components/ui/Spinner';
import { useAuth } from './lib/auth-context';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TerritoriesPage = lazy(() => import('./pages/TerritoriesPage'));
const FinishedTerritoriesPage = lazy(() => import('./pages/FinishedTerritoriesPage'));
const TemplateCardPage = lazy(() => import('./pages/TemplateCardPage'));
const NewTerritoryPage = lazy(() => import('./pages/NewTerritoryPage'));
const TerritoryDetailPage = lazy(() => import('./pages/TerritoryDetailPage'));
const EditTerritoryPage = lazy(() => import('./pages/EditTerritoryPage'));
const FieldLeadersPage = lazy(() => import('./pages/FieldLeadersPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const RelatorioFinalizadosPage = lazy(() => import('./pages/RelatorioFinalizadosPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return <LoadingScreen label="Carregando sessão…" />;
  }
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen label="Carregando…" />}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route
            path="/dirigentes"
            element={
              <RequirePermission scope="block:manage">
                <FieldLeadersPage />
              </RequirePermission>
            }
          />
          <Route path="/territories" element={<TerritoriesPage />} />
          <Route
            path="/territories/finalizados"
            element={
              <RequirePermission scope="territory:read">
                <FinishedTerritoriesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/territories/template"
            element={
              <RequirePermission scope="territory:read">
                <TemplateCardPage />
              </RequirePermission>
            }
          />
          <Route
            path="/territories/new"
            element={
              <RequirePermission scope="territory:create">
                <NewTerritoryPage />
              </RequirePermission>
            }
          />
          <Route path="/territories/:id" element={<TerritoryDetailPage />} />
          <Route
            path="/territories/:id/edit"
            element={
              <RequirePermission anyOf={['territory:update', 'block:manage']}>
                <EditTerritoryPage />
              </RequirePermission>
            }
          />
          <Route path="/usuarios" element={
              <RequirePermission scope="user:manage">
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/relatorios/finalizados"
            element={
              <RequirePermission scope="territory:read">
                <RelatorioFinalizadosPage />
              </RequirePermission>
            }
          />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/configuracao" element={<SettingsPage />} />
          <Route path="/sobre" element={<AboutPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ScrollToTop />
    </Suspense>
  );
}
