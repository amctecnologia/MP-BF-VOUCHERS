import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { Loja, Regiao } from '../../types';

export default function Lojas() {
  const [lojas, setLojas]       = useState<Loja[]>([]);
  const [regioes, setRegioes]   = useState<Regiao[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ nome: '', codigo_loja: '', regiao_id: '' });
  const [error, setError]       = useState('');
  const [deleteError, setDeleteError] = useState('');

  const load = () => {
    api.get('/lojas').then((r) => setLojas(r.data));
    api.get('/regioes').then((r) => setRegioes(r.data));
  };
  useEffect(load, []);

  async function salvar() {
    setError('');
    try {
      await api.post('/lojas', { ...form, regiao_id: Number(form.regiao_id) });
      setShowForm(false);
      setForm({ nome: '', codigo_loja: '', regiao_id: '' });
      load();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao salvar');
    }
  }

  async function excluir(id: number, nome: string) {
    setDeleteError('');
    if (!confirm(`Excluir a loja "${nome}"?`)) return;
    try {
      await api.delete(`/lojas/${id}`);
      load();
    } catch (e: unknown) {
      setDeleteError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao excluir');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lojas</h1>
        <button onClick={() => { setShowForm(true); setError(''); }}
          className="btn-primary">
          <Plus size={16} /> Nova Loja
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border">
          <h2 className="font-semibold mb-4">Nova Loja</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nome</label>
              <input className="input" value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Código Movere</label>
              <input className="input" value={form.codigo_loja}
                onChange={(e) => setForm({ ...form, codigo_loja: e.target.value })}
                placeholder="ex: 1042" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Região</label>
              <select className="input" value={form.regiao_id}
                onChange={(e) => setForm({ ...form, regiao_id: e.target.value })}>
                <option value="">Selecione...</option>
                {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={salvar} className="btn-primary">Salvar</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      {deleteError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {deleteError}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Loja', 'Cód. Movere', 'Região', 'Status', ''].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-gray-600 font-semibold">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lojas.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nenhuma loja cadastrada</td></tr>
            )}
            {lojas.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{l.nome}</td>
                <td className="px-4 py-3 font-mono text-gray-600">{l.codigo_loja}</td>
                <td className="px-4 py-3 text-gray-600">{l.regiao_nome}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${l.ativa ? 'badge-ATIVA' : 'badge-CANCELADA'}`}>
                    {l.ativa ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => excluir(l.id, l.nome)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Excluir loja">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
