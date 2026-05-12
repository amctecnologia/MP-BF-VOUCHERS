import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout/Layout';
import Campanhas from './pages/admin/Campanhas';
import CampanhaDetalhe from './pages/admin/CampanhaDetalhe';
import Categorias from './pages/admin/Categorias';
import Lojas from './pages/admin/Lojas';
import Usuarios from './pages/admin/Usuarios';
import Lancamentos from './pages/admin/Lancamentos';
import DashboardVendas from './pages/vendas/DashboardVendas';
import NovoLancamento from './pages/vendas/NovoLancamento';
import Aguardando from './pages/Aguardando';

function Protect({ children, perfil }: { children: React.ReactNode; perfil?: 'ADMIN' | 'VENDAS' }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (perfil && user.perfil !== perfil) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/aguardando" element={<Aguardando />} />
      <Route path="/" element={<Protect><Layout /></Protect>}>
        {user?.perfil === 'ADMIN' ? (
          <>
            <Route index element={<Navigate to="/campanhas" replace />} />
            <Route path="campanhas" element={<Campanhas />} />
            <Route path="campanhas/:id" element={<CampanhaDetalhe />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="lojas" element={<Lojas />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="lancamentos" element={<Lancamentos />} />
          </>
        ) : (
          <>
            <Route index element={<Navigate to="/vendas" replace />} />
            <Route path="vendas" element={<DashboardVendas />} />
            <Route path="vendas/lancamento/:campanha_categoria_id" element={<NovoLancamento />} />
          </>
        )}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
