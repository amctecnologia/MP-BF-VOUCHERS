import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data, status } = await api.post('/auth/login', { username, password });
      if (status === 202 && data.pendente) { nav('/aguardando'); return; }
      login(data.token, { ad_username: username, nome: data.nome, perfil: data.perfil, loja_id: data.loja_id });
      nav('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Erro ao fazer login');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-mp.png" alt="Minas Pneus" className="h-14 mb-4" />
          <p className="text-gray-500 text-sm">Vouchers Bridgestone</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuário (rede)</label>
            <input
              type="text" required autoFocus
              value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="seu.usuario"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-accent text-white rounded-lg py-2.5 font-semibold hover:bg-accent-dark disabled:opacity-50 transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
