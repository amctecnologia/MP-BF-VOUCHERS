import { useAuth } from '../../contexts/AuthContext';
import { LogOut } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-800">{user?.nome}</p>
          <p className="text-xs text-gray-500">{user?.perfil === 'ADMIN' ? 'Administrador' : 'Usuário de Vendas'}</p>
        </div>
        <button onClick={logout} title="Sair" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-accent transition-colors">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
