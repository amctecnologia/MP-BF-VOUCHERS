import { useAuth } from '../contexts/AuthContext';

export default function Aguardando() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        <img src="/logo-mp.png" alt="Minas Pneus" className="h-12 mx-auto mb-6" />
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⏳</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Acesso em análise</h2>
        <p className="text-gray-500 mb-6">Seu cadastro foi registrado. Aguarde a liberação pelo administrador do sistema.</p>
        <button onClick={logout} className="text-accent text-sm hover:underline">Sair</button>
      </div>
    </div>
  );
}
