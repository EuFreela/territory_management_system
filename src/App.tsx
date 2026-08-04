import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import RequirePermission from './components/RequirePermission';
import ScrollToTop from './components/ui/ScrollToTop';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TerritoriesPage from './pages/TerritoriesPage';
import FinishedTerritoriesPage from './pages/FinishedTerritoriesPage';
import NewTerritoryPage from './pages/NewTerritoryPage';
import TerritoryDetailPage from './pages/TerritoryDetailPage';
import EditTerritoryPage from './pages/EditTerritoryPage';
import FieldLeadersPage from './pages/FieldLeadersPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import UsersPage from './pages/UsersPage';
import { useAuth } from './lib/auth-context';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-apple-bg text-[15px] text-apple-secondary">
        Carregando…
      </div>
    );
  }
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dirigentes" element={<FieldLeadersPage />} />
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
          <Route
            path="/usuarios"
            element={
              <RequirePermission scope="user:manage">
                <UsersPage />
              </RequirePermission>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ScrollToTop />
    </>
  );
}
