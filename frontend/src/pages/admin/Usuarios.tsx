import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Usuario, Loja } from '../../types';
import { Check, X } from 'lucide-react';

export default function Usuarios() {
  const [usuarios, setUsuarios]   = useState<Usuario[]>([]);
  const [pendentes, setPendentes] = useState<Usuario[]>([]);
  const [lojas, setLojas]         = useState<Loja[]>([]);
  const [lojaMap, setLojaMap]     = useState<Record<number, number>>({});

  const load = () => {
    api.get('/usuarios').then((r)          => setUsuarios(r.data));
    api.get('/usuarios/pendentes').then((r) => setPendentes(r.data));
    api.get('/lojas').then((r)              => setLojas(r.data));
  };
  useEffect(load, []);

  async function aprovar(id: number) {
    const loja_id = lojaMap[id];
    if (!loja_id) { alert('Selecione a loja antes de aprovar.'); return; }
    await api.post(`/usuarios/${id}/aprovar`, { loja_id });
    load();
  }

  const STATUS_LABEL: Record<string, string> = { ATIVO: 'Ativo', INATIVO: 'Inativo', PENDENTE_APROVACAO: 'Pendente' };

  return (
    <div className="space-y-8">
      {pendentes.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full inline-block" />
            Aguardando Aprovação ({pendentes.length})
          </h2>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-yellow-50 border-b">
                <tr>{['Usuário (AD)', 'Nome', 'E-mail', 'Solicita em', 'Loja', 'Ação'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-600 font-semibold">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y">
                {pendentes.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono">{u.ad_username}</td>
                    <td className="px-4 py-3">{u.nome}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.criado_em ? new Date((u as unknown as { criado_em: string }).criado_em).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-4 py-3">
                      <select className="input text-sm" value={lojaMap[u.id] || ''} onChange={(e) => setLojaMap({...lojaMap, [u.id]: Number(e.target.value)})}>
                        <option value="">Selecione a loja...</option>
                        {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => aprovar(u.id)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200">
                        <Check size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Todos os Usuários</h1>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Usuário', 'Nome', 'Perfil', 'Loja', 'Status', 'Ação'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-600 font-semibold">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{u.ad_username}</td>
                  <td className="px-4 py-3">{u.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{u.perfil}</td>
                  <td className="px-4 py-3 text-gray-600">{u.loja_nome || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold badge-${u.status === 'ATIVO' ? 'ATIVA' : u.status === 'PENDENTE_APROVACAO' ? 'PENDENTE' : 'CANCELADO'}`}>
                      {STATUS_LABEL[u.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.status === 'ATIVO' && (
                      <button onClick={() => api.post(`/usuarios/${u.id}/inativar`).then(load)} className="p-1.5 hover:text-red-600 text-gray-400" title="Inativar">
                        <X size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
