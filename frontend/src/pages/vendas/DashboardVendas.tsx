import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, TrendingUp, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { SaldoLoja } from '../../types';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Grupo { campanha_nome: string; data_inicio: string; data_fim: string; itens: SaldoLoja[]; }

export default function DashboardVendas() {
  const { user }    = useAuth();
  const nav         = useNavigate();
  const [saldos, setSaldos]   = useState<SaldoLoja[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get('/campanhas/saldo/loja')
      .then((r) => setSaldos(r.data))
      .catch(() => setError('Erro ao carregar saldos'))
      .finally(() => setLoading(false));
  }, []);

  const grupos: Grupo[] = Object.values(
    saldos.reduce<Record<string, Grupo>>((acc, s) => {
      if (!acc[s.campanha_nome]) {
        acc[s.campanha_nome] = { campanha_nome: s.campanha_nome, data_inicio: s.data_inicio, data_fim: s.data_fim, itens: [] };
      }
      acc[s.campanha_nome].itens.push(s);
      return acc;
    }, {})
  );

  const totalSaldo     = saldos.reduce((s, x) => s + x.saldo_disponivel, 0);
  const categoriasAtivas = saldos.filter((x) => x.saldo_disponivel > 0).length;

  if (loading) return <div className="p-8 text-gray-500">Carregando...</div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Boas-vindas */}
      <div>
        <h1 className="text-2xl font-bold text-primary">Olá, {user?.nome?.split(' ')[0]}</h1>
        <p className="text-gray-500 text-sm">Consulte seu saldo de vouchers e registre novos usos.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="bg-accent/10 p-3 rounded-lg">
            <Ticket className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Vouchers disponíveis</p>
            <p className="text-2xl font-bold text-primary">{totalSaldo}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="bg-green-50 p-3 rounded-lg">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Categorias com saldo</p>
            <p className="text-2xl font-bold text-primary">{categoriasAtivas}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {grupos.length === 0 && !error && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <Ticket className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma campanha ativa com saldo disponível para sua loja.</p>
        </div>
      )}

      {/* Cards por campanha */}
      {grupos.map((grupo) => (
        <div key={grupo.campanha_nome} className="space-y-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-base font-semibold text-primary">{grupo.campanha_nome}</h2>
            <span className="text-xs text-gray-400">
              {new Date(grupo.data_inicio).toLocaleDateString('pt-BR')} –{' '}
              {new Date(grupo.data_fim).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {grupo.itens.map((item) => (
              <div
                key={item.campanha_categoria_id}
                className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-primary">{item.categoria_nome}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{item.categoria_codigo}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      item.saldo_disponivel > 0
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {item.saldo_disponivel > 0 ? `${item.saldo_disponivel} disp.` : 'Sem saldo'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Valor do voucher</p>
                    <p className="font-bold text-lg text-accent">{fmt(item.valor_desconto)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-xs">Distribuído</p>
                    <p className="font-medium">{item.quantidade_distribuida}</p>
                  </div>
                </div>

                <button
                  disabled={item.saldo_disponivel === 0}
                  onClick={() => nav(`/vendas/lancamento/${item.campanha_categoria_id}`)}
                  className="btn-primary w-full justify-center"
                >
                  Registrar Uso
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
