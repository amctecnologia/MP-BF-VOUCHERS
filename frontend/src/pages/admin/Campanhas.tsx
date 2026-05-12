import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api from '../../services/api';
import { Campanha } from '../../types';

const STATUS_LABELS: Record<string, string> = { RASCUNHO: 'Rascunho', ATIVA: 'Ativa', ENCERRADA: 'Encerrada', CANCELADA: 'Cancelada' };

export default function Campanhas() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    api.get('/campanhas').then((r) => setCampanhas(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
        <Link to="/campanhas/nova" className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-dark text-sm font-medium transition-colors">
          <Plus size={16} /> Nova Campanha
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Carregando...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Campanha', 'Período', 'Categorias', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-600 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campanhas.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{c.data_inicio} → {c.data_fim}</td>
                  <td className="px-4 py-3 text-gray-600">{c.total_categorias}</td>
                  <td className="px-4 py-3">
                    <span className={`badge-${c.status} text-xs font-semibold px-2 py-1 rounded-full`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/campanhas/${c.id}`} className="text-accent hover:underline text-sm">Ver detalhes</Link>
                  </td>
                </tr>
              ))}
              {!campanhas.length && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">Nenhuma campanha cadastrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
