import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { CampanhaDetalhe as ICampanhaDetalhe, Categoria, Regiao, Loja } from '../../types';

const STATUS_CAMPANHA = ['RASCUNHO', 'ATIVA', 'ENCERRADA', 'CANCELADA'];
const STATUS_LABELS: Record<string, string> = { RASCUNHO: 'Rascunho', ATIVA: 'Ativa', ENCERRADA: 'Encerrada', CANCELADA: 'Cancelada' };
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface LojaQtd { loja_id: number; nome: string; quantidade_distribuida: number; }
interface RegiaoForm { regiao_id: number; nome: string; quantidade_regional: number; lojas: LojaQtd[]; }

export default function CampanhaDetalhe() {
  const { id } = useParams();
  const nav    = useNavigate();
  const isNova = id === 'nova';

  const [camp, setCamp]       = useState<ICampanhaDetalhe | null>(null);
  const [categorias, setCats] = useState<Categoria[]>([]);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [todasLojas, setTodasLojas] = useState<Loja[]>([]);

  // Form nova campanha
  const [formCamp, setFormCamp] = useState({ nome: '', descricao: '', data_inicio: '', data_fim: '' });
  // Form nova categoria
  const [showCatForm, setShowCatForm]  = useState(false);
  const [catForm, setCatForm] = useState({ categoria_id: '', valor_desconto: '', quantidade_total: '' });
  const [regioesForm, setRegioesForm]  = useState<RegiaoForm[]>([]);
  const [expandedCat, setExpandedCat] = useState<number | null>(null);
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);

  const load = () => {
    api.get('/categorias?ativas=true').then((r) => setCats(r.data));
    api.get('/regioes').then((r: { data: Regiao[] }) => setRegioes(r.data));
    api.get('/lojas').then((r: { data: Loja[] }) => setTodasLojas(r.data));
    if (!isNova && id) api.get(`/campanhas/${id}`).then((r) => setCamp(r.data));
  };
  useEffect(load, [id]);

  // Quando regiões e lojas carregam, inicializa o form de distribuição
  useEffect(() => {
    if (!regioes.length || !todasLojas.length) return;
    setRegioesForm(regioes.map((r) => ({
      regiao_id: r.id, nome: r.nome, quantidade_regional: 0,
      lojas: todasLojas.filter((l) => l.regiao_id === r.id).map((l) => ({ loja_id: l.id, nome: l.nome, quantidade_distribuida: 0 })),
    })));
  }, [regioes, todasLojas]);

  const somaRegioes    = regioesForm.reduce((s, r) => s + r.quantidade_regional, 0);
  const totalEsperado  = Number(catForm.quantidade_total) || 0;
  const distribuicaoOk = somaRegioes === totalEsperado && totalEsperado > 0;

  async function criarCampanha() {
    setSaving(true); setError('');
    try {
      const { data } = await api.post('/campanhas', formCamp);
      nav(`/campanhas/${data.id}`);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro');
    } finally { setSaving(false); }
  }

  async function salvarCategoria() {
    setSaving(true); setError('');
    try {
      await api.post(`/campanhas/${camp!.id}/categorias`, {
        categoria_id: Number(catForm.categoria_id),
        valor_desconto: Number(catForm.valor_desconto),
        quantidade_total: Number(catForm.quantidade_total),
        regioes: regioesForm.map((r) => ({
          regiao_id: r.regiao_id,
          quantidade_regional: r.quantidade_regional,
          lojas: r.lojas.map((l) => ({ loja_id: l.loja_id, quantidade_distribuida: l.quantidade_distribuida })),
        })),
      });
      setShowCatForm(false);
      setCatForm({ categoria_id: '', valor_desconto: '', quantidade_total: '' });
      load();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao salvar categoria');
    } finally { setSaving(false); }
  }

  async function mudarStatus(status: string) {
    if (status === 'ATIVA') {
      const temDistribuicao = (camp!.categorias || []).some(
        (cc) => cc.regioes?.some((r) => r.lojas?.some((l) => l.quantidade_distribuida > 0))
      );
      if (!temDistribuicao) {
        setError('A campanha precisa ter ao menos uma categoria com vouchers distribuídos para lojas antes de ser ativada.');
        return;
      }
    }
    setError('');
    await api.patch(`/campanhas/${camp!.id}/status`, { status });
    load();
  }

  function updateRegiao(idx: number, val: number) {
    const next = [...regioesForm];
    next[idx].quantidade_regional = val;
    setRegioesForm(next);
  }
  function updateLoja(rIdx: number, lIdx: number, val: number) {
    const next = [...regioesForm];
    next[rIdx].lojas[lIdx].quantidade_distribuida = val;
    setRegioesForm(next);
  }

  if (isNova) return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Nova Campanha</h1>
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <label className="text-sm text-gray-600">Nome da Campanha</label>
          <input className="input mt-1 w-full" value={formCamp.nome} onChange={(e) => setFormCamp({...formCamp, nome: e.target.value})} />
        </div>
        <div>
          <label className="text-sm text-gray-600">Descrição</label>
          <textarea className="input mt-1 w-full h-20" value={formCamp.descricao} onChange={(e) => setFormCamp({...formCamp, descricao: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600">Data de Início</label>
            <input type="date" className="input mt-1 w-full" value={formCamp.data_inicio} onChange={(e) => setFormCamp({...formCamp, data_inicio: e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-gray-600">Data de Fim</label>
            <input type="date" className="input mt-1 w-full" value={formCamp.data_fim} onChange={(e) => setFormCamp({...formCamp, data_fim: e.target.value})} />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button onClick={criarCampanha} disabled={saving} className="bg-accent text-white px-6 py-2 rounded-lg text-sm disabled:opacity-50">
            {saving ? 'Salvando...' : 'Criar Campanha'}
          </button>
          <button onClick={() => nav('/campanhas')} className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-100">Cancelar</button>
        </div>
      </div>
    </div>
  );

  if (!camp) return <div className="text-center py-20 text-gray-400">Carregando...</div>;

  return (
    <div>
      {/* Header da campanha */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => nav('/campanhas')} className="text-sm text-gray-500 hover:text-accent mb-2">← Campanhas</button>
          <h1 className="text-2xl font-bold text-gray-900">{camp.nome}</h1>
          <p className="text-gray-500 text-sm mt-1">{camp.data_inicio} → {camp.data_fim}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge-${camp.status} text-sm px-3 py-1 rounded-full font-semibold`}>{STATUS_LABELS[camp.status]}</span>
          {camp.status === 'RASCUNHO' && <button onClick={() => mudarStatus('ATIVA')} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">Ativar</button>}
          {camp.status === 'ATIVA'    && <button onClick={() => mudarStatus('ENCERRADA')} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm">Encerrar</button>}
        </div>
      </div>

      {/* Categorias existentes */}
      <div className="space-y-4 mb-6">
        {(camp.categorias || []).map((cc) => (
          <div key={cc.id} className="bg-white rounded-xl shadow-sm border">
            <button className="w-full flex items-center justify-between p-4 text-left"
              onClick={() => setExpandedCat(expandedCat === cc.id ? null : cc.id)}>
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-semibold">{cc.categoria_nome}</p>
                  <p className="text-sm text-gray-500">{cc.categoria_codigo}</p>
                </div>
                <span className="text-accent font-bold">{fmt(cc.valor_desconto)}</span>
                <span className="text-gray-500 text-sm">Total: {cc.quantidade_total} vouchers</span>
              </div>
              {expandedCat === cc.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {expandedCat === cc.id && (
              <div className="border-t px-4 pb-4 pt-3">
                {(cc.regioes || []).map((reg) => (
                  <div key={reg.regiao_id} className="mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">{reg.regiao_nome} — {reg.quantidade_regional} vouchers</p>
                    <table className="w-full text-sm">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">Loja</th><th className="text-right py-1">Distribuído</th><th className="text-right py-1">Saldo</th></tr></thead>
                      <tbody>
                        {(reg.lojas || []).map((l) => (
                          <tr key={l.loja_id} className="border-t">
                            <td className="py-1.5">{l.loja_nome} <span className="text-gray-400 text-xs">({l.loja_codigo})</span></td>
                            <td className="text-right py-1.5">{l.quantidade_distribuida}</td>
                            <td className={`text-right py-1.5 font-semibold ${l.saldo_disponivel === 0 ? 'text-red-500' : 'text-green-600'}`}>{l.saldo_disponivel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Formulário de nova categoria */}
      {['RASCUNHO', 'ATIVA'].includes(camp.status) && !showCatForm && (
        <button onClick={() => setShowCatForm(true)}
          className="flex items-center gap-2 border-2 border-dashed border-gray-300 text-gray-500 hover:border-accent hover:text-accent px-4 py-3 rounded-xl w-full justify-center transition-colors">
          <Plus size={18} /> Adicionar Categoria
        </button>
      )}

      {showCatForm && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold mb-4">Nova Categoria</h3>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="col-span-1">
              <label className="text-sm text-gray-600">Categoria Bridgestone</label>
              <select className="input mt-1 w-full" value={catForm.categoria_id}
                onChange={(e) => setCatForm({...catForm, categoria_id: e.target.value})}>
                <option value="">Selecione...</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">Valor do Voucher (R$)</label>
              <input type="number" step="0.01" className="input mt-1 w-full" value={catForm.valor_desconto}
                onChange={(e) => setCatForm({...catForm, valor_desconto: e.target.value})} />
            </div>
            <div>
              <label className="text-sm text-gray-600">Total Bridgestone</label>
              <input type="number" className="input mt-1 w-full" value={catForm.quantidade_total}
                onChange={(e) => setCatForm({...catForm, quantidade_total: e.target.value})} />
            </div>
          </div>

          {/* Distribuição por região/loja */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 flex justify-between text-sm font-semibold text-gray-600">
              <span>Distribuição por Região e Loja</span>
              <span className={distribuicaoOk ? 'text-green-600' : 'text-orange-500'}>
                Distribuído: {somaRegioes} / Total: {totalEsperado} {distribuicaoOk ? '✓' : ''}
              </span>
            </div>
            {regioesForm.map((reg, rIdx) => (
              <div key={reg.regiao_id} className="border-t">
                <div className="flex items-center gap-4 px-4 py-2 bg-gray-50/50">
                  <span className="font-medium text-sm w-32">{reg.nome}</span>
                  <input type="number" min={0} className="input text-sm w-24"
                    placeholder="Cota regional"
                    value={reg.quantidade_regional || ''}
                    onChange={(e) => updateRegiao(rIdx, Number(e.target.value))} />
                  <span className="text-xs text-gray-400">vouchers para esta região</span>
                </div>
                {reg.lojas.map((loja, lIdx) => {
                  const somaLojas = reg.lojas.reduce((s, l) => s + l.quantidade_distribuida, 0);
                  return (
                    <div key={loja.loja_id} className="flex items-center gap-4 px-8 py-1.5 border-t border-gray-100">
                      <span className="text-sm text-gray-700 flex-1">{loja.nome}</span>
                      <input type="number" min={0} className="input text-sm w-24"
                        value={loja.quantidade_distribuida || ''}
                        onChange={(e) => updateLoja(rIdx, lIdx, Number(e.target.value))} />
                      {lIdx === reg.lojas.length - 1 && somaLojas > reg.quantidade_regional && (
                        <span className="text-xs text-red-500">Excede cota regional!</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={salvarCategoria} disabled={saving || !distribuicaoOk}
              className="bg-accent text-white px-5 py-2 rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar Categoria'}
            </button>
            <button onClick={() => { setShowCatForm(false); setError(''); }}
              className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-100">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
