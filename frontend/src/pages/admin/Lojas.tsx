import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../../services/api';
import { Loja, Regiao } from '../../types';

export default function Lojas() {
  const [lojas, setLojas]       = useState<Loja[]>([]);
  const [regioes, setRegioes]   = useState<Regiao[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ nome: '', codigo_loja: '', cidade: '', estado: '', regiao_id: '' });
  const [error, setError]       = useState('');

  const load = () => {
    api.get('/lojas').then((r) => setLojas(r.data));
    api.get('/regioes').then((r) => setRegioes(r.data));
  };
  useEffect(load, []);

  async function salvar() {
    setError('');
    try {
      await api.post('/lojas', { ...form, regiao_id: Number(form.regiao_id) });
      setShowForm(false); setForm({ nome: '', codigo_loja: '', cidade: '', estado: '', regiao_id: '' });
      load();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lojas</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-dark text-sm font-medium">
          <Plus size={16} /> Nova Loja
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border">
          <h2 className="font-semibold mb-4">Nova Loja</h2>
          <div className="grid grid-cols-2 gap-4">
            {[['Nome', 'nome'], ['Código', 'codigo_loja'], ['Cidade', 'cidade'], ['Estado (UF)', 'estado']].map(([l, k]) => (
              <div key={k}>
                <label className="text-sm text-gray-600">{l}</label>
                <input className="input mt-1 w-full" value={(form as Record<string,string>)[k]} maxLength={k === 'estado' ? 2 : undefined}
                  onChange={(e) => setForm({...form, [k]: e.target.value})} />
              </div>
            ))}
            <div>
              <label className="text-sm text-gray-600">Região</label>
              <select className="input mt-1 w-full" value={form.regiao_id} onChange={(e) => setForm({...form, regiao_id: e.target.value})}>
                <option value="">Selecione...</option>
                {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={salvar} className="bg-accent text-white px-4 py-2 rounded-lg text-sm">Salvar</button>
            <button onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-100">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Loja', 'Código', 'Cidade / UF', 'Região', 'Status'].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-gray-600 font-semibold">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lojas.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{l.nome}</td>
                <td className="px-4 py-3 font-mono text-gray-600">{l.codigo_loja}</td>
                <td className="px-4 py-3 text-gray-600">{l.cidade} / {l.estado}</td>
                <td className="px-4 py-3 text-gray-600">{l.regiao_nome}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${l.ativa ? 'badge-ATIVA' : 'badge-CANCELADA'}`}>
                    {l.ativa ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
