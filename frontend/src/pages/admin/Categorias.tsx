import { useEffect, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import api from '../../services/api';
import { Categoria } from '../../types';

export default function Categorias() {
  const [lista, setLista]       = useState<Categoria[]>([]);
  const [form, setForm]         = useState({ nome: '', codigo: '', descricao: '' });
  const [editing, setEditing]   = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError]       = useState('');

  const load = () => api.get('/categorias').then((r) => setLista(r.data));
  useEffect(() => { load(); }, []);

  async function salvar() {
    setError('');
    try {
      if (editing) await api.put(`/categorias/${editing}`, form);
      else         await api.post('/categorias', form);
      setShowForm(false); setEditing(null); setForm({ nome: '', codigo: '', descricao: '' });
      load();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catálogo de Categorias</h1>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ nome: '', codigo: '', descricao: '' }); }}
          className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-dark text-sm font-medium">
          <Plus size={16} /> Nova Categoria
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <h2 className="font-semibold mb-4">{editing ? 'Editar' : 'Nova'} Categoria</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Nome</label>
              <input className="input mt-1 w-full" value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-600">Código</label>
              <input className="input mt-1 w-full uppercase" value={form.codigo} onChange={(e) => setForm({...form, codigo: e.target.value.toUpperCase()})} />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-600">Descrição</label>
              <input className="input mt-1 w-full" value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} />
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
            <tr>{['Nome', 'Código', 'Descrição', 'Status', ''].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-gray-600 font-semibold">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lista.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.nome}</td>
                <td className="px-4 py-3 font-mono text-gray-600">{c.codigo}</td>
                <td className="px-4 py-3 text-gray-500">{c.descricao || '—'}</td>
                <td className="px-4 py-3">
                  <span className={c.ativa ? 'badge-ATIVA' : 'badge-CANCELADA' + ' text-xs px-2 py-1 rounded-full font-semibold'}>
                    {c.ativa ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => { setForm({ nome: c.nome, codigo: c.codigo, descricao: c.descricao || '' }); setEditing(c.id); setShowForm(true); }}
                    className="p-1 hover:text-accent"><Pencil size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
