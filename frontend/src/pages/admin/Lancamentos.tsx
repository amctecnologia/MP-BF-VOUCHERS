import { useEffect, useState } from 'react';
import { Check, X, Eye } from 'lucide-react';
import api from '../../services/api';
import { Lancamento } from '../../types';

const STATUS_LABEL: Record<string, string> = { PENDENTE: 'Pendente', VALIDADO: 'Validado', CANCELADO: 'Cancelado' };
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Lancamentos() {
  const [lista, setLista]   = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ status: '', data_inicio: '', data_fim: '' });
  const [obs, setObs]       = useState('');
  const [modal, setModal]   = useState<Lancamento | null>(null);
  const [acao, setAcao]     = useState<'validar' | 'cancelar' | null>(null);

  const load = () => {
    setLoading(true);
    const p = new URLSearchParams(Object.fromEntries(Object.entries(filtros).filter(([, v]) => v)));
    api.get(`/lancamentos?${p}`).then((r) => setLista(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  async function executarAcao() {
    if (!modal || !acao) return;
    await api.patch(`/lancamentos/${modal.id}/${acao}`, { observacao: obs });
    setModal(null); setAcao(null); setObs('');
    load();
  }

  async function exportarExcel() {
    const p = new URLSearchParams(Object.fromEntries(Object.entries(filtros).filter(([, v]) => v)));
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/relatorios/lancamentos/export?${p}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lancamentos-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Lançamentos</h1>
        <button onClick={exportarExcel} className="text-sm text-accent hover:underline">Exportar Excel</button>
      </div>

      <div className="bg-white rounded-xl p-4 mb-4 flex gap-4 shadow-sm border">
        <select className="input text-sm" value={filtros.status} onChange={(e) => setFiltros({...filtros, status: e.target.value})}>
          <option value="">Todos os status</option>
          {['PENDENTE','VALIDADO','CANCELADO'].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <input type="date" className="input text-sm" value={filtros.data_inicio} onChange={(e) => setFiltros({...filtros, data_inicio: e.target.value})} />
        <input type="date" className="input text-sm" value={filtros.data_fim}    onChange={(e) => setFiltros({...filtros, data_fim: e.target.value})} />
        <button onClick={load} className="bg-accent text-white px-4 py-2 rounded-lg text-sm">Filtrar</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Data', 'Campanha', 'Categoria', 'Loja', 'Cliente', 'NF', 'Vouchers', 'Total', 'Status', 'Ações'].map((h) => (
              <th key={h} className="text-left px-3 py-3 text-gray-600 font-semibold">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={10} className="text-center py-10 text-gray-400">Carregando...</td></tr>
            ) : lista.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-600">{l.data_venda}</td>
                <td className="px-3 py-2">{l.campanha_nome}</td>
                <td className="px-3 py-2 text-gray-600">{l.categoria_nome}</td>
                <td className="px-3 py-2 text-gray-600">{l.loja_nome}</td>
                <td className="px-3 py-2">{l.nome_cliente}</td>
                <td className="px-3 py-2 font-mono">{l.numero_nota_fiscal}</td>
                <td className="px-3 py-2 text-center">{l.quantidade_vouchers_aplicados}</td>
                <td className="px-3 py-2 font-semibold">{fmt(l.valor_desconto_total)}</td>
                <td className="px-3 py-2">
                  <span className={`badge-${l.status} text-xs px-2 py-1 rounded-full font-semibold`}>{STATUS_LABEL[l.status]}</span>
                </td>
                <td className="px-3 py-2 flex gap-1">
                  {l.anexo_nota_fiscal && (
                    <a href={`/api/uploads/${l.anexo_nota_fiscal}`} target="_blank" rel="noreferrer"
                      className="p-1 hover:text-accent text-gray-400" title="Ver NF"><Eye size={15} /></a>
                  )}
                  {l.status === 'PENDENTE' && (
                    <>
                      <button onClick={() => { setModal(l); setAcao('validar'); }}
                        className="p-1 hover:text-green-600 text-gray-400" title="Validar lançamento"><Check size={15} /></button>
                      <button onClick={() => { setModal(l); setAcao('cancelar'); }}
                        className="p-1 hover:text-red-600 text-gray-400" title="Cancelar lançamento"><X size={15} /></button>
                    </>
                  )}
                  {l.status === 'VALIDADO' && (
                    <button onClick={() => { setModal(l); setAcao('cancelar'); }}
                      className="p-1 hover:text-red-600 text-gray-400" title="Cancelar lançamento"><X size={15} /></button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && !lista.length && (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400">Nenhum lançamento encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-3">
              {acao === 'validar' ? '✅ Validar' : '❌ Cancelar'} Lançamento #{modal.id}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {modal.nome_cliente} — {modal.categoria_nome} — {modal.quantidade_vouchers_aplicados} voucher(s)
            </p>
            <textarea className="input w-full h-20 text-sm" placeholder="Observação (opcional)"
              value={obs} onChange={(e) => setObs(e.target.value)} />
            <div className="flex gap-2 mt-4">
              <button onClick={executarAcao}
                className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${acao === 'validar' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                Confirmar
              </button>
              <button onClick={() => { setModal(null); setAcao(null); setObs(''); }}
                className="px-4 py-2 rounded-lg text-gray-600 text-sm hover:bg-gray-100">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
