import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, Tag, Store, Users, FileText, Megaphone } from 'lucide-react';
import PendenteBadge from './PendenteBadge';

const adminLinks = [
  { to: '/campanhas',  label: 'Campanhas',   icon: Megaphone },
  { to: '/lancamentos',label: 'Lançamentos', icon: FileText, badge: true },
  { to: '/categorias', label: 'Categorias',  icon: Tag },
  { to: '/lojas',      label: 'Lojas',       icon: Store },
  { to: '/usuarios',   label: 'Usuários',    icon: Users },
];

const vendasLinks = [
  { to: '/vendas', label: 'Meu Painel', icon: LayoutDashboard },
];

export default function Sidebar() {
  const { user } = useAuth();
  const links = user?.perfil === 'ADMIN' ? adminLinks : vendasLinks;

  return (
    <aside className="w-60 bg-primary flex flex-col shrink-0">
      <div className="p-5 border-b border-primary-light">
        <img src="/logo-mp.png" alt="Minas Pneus" className="h-8 brightness-0 invert" />
        <p className="text-gray-400 text-xs mt-1">Vouchers Bridgestone</p>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-3">
        {links.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to} to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group ${
                isActive
                  ? 'bg-accent text-white'
                  : 'text-gray-300 hover:bg-primary-light hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {badge && <PendenteBadge />}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-primary-light">
        <p className="text-gray-400 text-xs truncate">{user?.nome}</p>
        <p className="text-gray-500 text-xs">{user?.perfil}</p>
      </div>
    </aside>
  );
}
