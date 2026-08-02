import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ui/ScrollToTop';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TerritoriesPage from './pages/TerritoriesPage';
import NewTerritoryPage from './pages/NewTerritoryPage';
import TerritoryDetailPage from './pages/TerritoryDetailPage';
import EditTerritoryPage from './pages/EditTerritoryPage';
import FieldLeadersPage from './pages/FieldLeadersPage';
import { useAuth } from './lib/auth-context';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-600">Carregando…</div>;
  }
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dirigentes" element={<FieldLeadersPage />} />
          <Route path="/territories" element={<TerritoriesPage />} />
          <Route path="/territories/new" element={<NewTerritoryPage />} />
          <Route path="/territories/:id" element={<TerritoryDetailPage />} />
          <Route path="/territories/:id/edit" element={<EditTerritoryPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ScrollToTop />
    </>
  );
}
