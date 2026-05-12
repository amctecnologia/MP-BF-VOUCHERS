import { Fragment, useEffect, useState } from 'react';
import api from '../../services/api';
import { Campanha, CampanhaDetalhe, CampanhaCategoria, DistribuicaoRegiao, DistribuicaoLoja } from '../../types';

export default function Redistribuicao() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [campanhaId, setCampanhaId] = useState('');
  const [detalhe, setDetalhe] = useState<CampanhaDetalhe | null>(null);
  const [catId, setCatId] = useState('');

  const [lojaOrigem, setLojaOrigem] = useState('');
  const [lojaDestino, setLojaDestino] = useState('');
  const [qtdLoja, setQtdLoja] = useState('');
  const [erroLoja, setErroLoja] = useState('');
  const [okLoja, setOkLoja] = useState(false);

  const [regOrigem, setRegOrigem] = useState('');
  const [regDestino, setRegDestino] = useState('');
  const [qtdReg, setQtdReg] = useState('');
  const [erroReg, setErroReg] = useState('');
  const [okReg, setOkReg] = useState(false);

  useEffect(() => {
    api.get('/campanhas').then((r) => {
      setCampanhas((r.data as Campanha[]).filter((c) => c.status === 'ATIVA'));
    });
  }, []);

  useEffect(() => {
    if (!campanhaId) { setDetalhe(null); setCatId(''); return; }
    api.get(`/campanhas/${campanhaId}`).then((r) => {
      setDetalhe(r.data);
      setCatId('');
    });
  }, [campanhaId]);

  function reload() {
    if (!campanhaId) return;
    api.get(`/campanhas/${campanhaId}`).then((r) => setDetalhe(r.data));
  }

  const cat: CampanhaCategoria | undefined = detalhe?.categorias.find((c) => String(c.id) === catId);

  const todasLojas: DistribuicaoLoja[] = cat?.regioes.flatMap((r) => r.lojas) ?? [];
  const lojasComSaldo = todasLojas.filter((l) => l.saldo_disponivel > 0);

  function cotaLivre(r: DistribuicaoRegiao) {
    const alocado = r.lojas.reduce((s, l) => s + l.quantidade_distribuida, 0);
    return r.quantidade_regional - alocado;
  }

  const regioesComLivre = cat?.regioes.filter((r) => cotaLivre(r) > 0) ?? [];

  const maxReg = regOrigem && cat
    ? cotaLivre(cat.regioes.find((x) => String(x.regiao_id) === regOrigem)!)
    : null;

  async function transferirLojas() {
    setErroLoja(''); setOkLoja(false);
    if (!catId || !lojaOrigem || !lojaDestino || !qtdLoja) { setErroLoja('Preencha todos os campos.'); return; }
    if (lojaOrigem === lojaDestino) { setErroLoja('Origem e destino devem ser lojas diferentes.'); return; }
    try {
      await api.post('/distribuicao/redistribuir', {
        campanha_categoria_id: Number(catId),
        loja_origem_id: Number(lojaOrigem),
        loja_destino_id: Number(lojaDestino),
        quantidade: Number(qtdLoja),
      });
      setOkLoja(true); setQtdLoja(''); setLojaOrigem(''); setLojaDestino('');
      reload();
    } catch (e: unknown) {
      setErroLoja((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erro ao redistribuir');
    }
  }

  async function transferirRegioes() {
    setErroReg(''); setOkReg(false);
    if (!catId || !regOrigem || !regDestino || !qtdReg) { setErroReg('Preencha todos os campos.'); return; }
    if (regOrigem === regDestino) { setErroReg('Origem e destino devem ser regiões diferentes.'); return; }
    try {
      await api.post('/distribuicao/redistribuir-regional', {
        campanha_categoria_id: Number(catId),
        regiao_origem_id: Number(regOrigem),
        regiao_destino_id: Number(regDestino),
        quantidade: Number(qtdReg),
      });
      setOkReg(true); setQtdReg(''); setRegOrigem(''); setRegDestino('');
      reload();
    } catch (e: unknown) {
      setErroReg((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erro ao redistribuir');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Redistribuição de Vouchers</h1>

      {/* Seletores */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border flex gap-4">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Campanha</label>
          <select className="input text-sm w-full" value={campanhaId} onChange={(e) => setCampanhaId(e.target.value)}>
            <option value="">Selecione...</option>
            {campanhas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Categoria</label>
          <select className="input text-sm w-full" value={catId} onChange={(e) => setCatId(e.target.value)} disabled={!detalhe}>
            <option value="">Selecione...</option>
            {detalhe?.categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.categoria_nome} — R$ {c.valor_desconto.toFixed(2)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Painel de distribuição atual */}
      {cat && (
        <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <span className="font-semibold text-sm">{cat.categoria_nome}</span>
            <span className="text-gray-400 text-xs ml-2">Total: {cat.quantidade_total} vouchers</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-gray-600 font-semibold">Região / Loja</th>
                <th className="text-right px-3 py-2 text-gray-600 font-semibold">Cota Regional</th>
                <th className="text-right px-3 py-2 text-gray-600 font-semibold">Distribuído</th>
                <th className="text-right px-3 py-2 text-gray-600 font-semibold">Usado</th>
                <th className="text-right px-3 py-2 text-gray-600 font-semibold">Saldo</th>
                <th className="text-right px-3 py-2 text-gray-600 font-semibold">Cota Livre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cat.regioes.map((reg) => {
                const livre = cotaLivre(reg);
                const regDist = reg.lojas.reduce((s, l) => s + l.quantidade_distribuida, 0);
                const regSaldo = reg.lojas.reduce((s, l) => s + l.saldo_disponivel, 0);
                const regUsado = regDist - regSaldo;
                return (
                  <Fragment key={reg.regiao_id}>
                    <tr className="bg-gray-50 font-medium">
                      <td className="px-3 py-2 text-gray-800">{reg.regiao_nome}</td>
                      <td className="px-3 py-2 text-right">{reg.quantidade_regional}</td>
                      <td className="px-3 py-2 text-right">{regDist}</td>
                      <td className="px-3 py-2 text-right text-orange-600">{regUsado}</td>
                      <td className="px-3 py-2 text-right text-green-700 font-semibold">{regSaldo}</td>
                      <td className="px-3 py-2 text-right text-blue-600 font-semibold">{livre}</td>
                    </tr>
                    {reg.lojas.map((loja) => (
                      <tr key={loja.loja_id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 pl-8 text-gray-600">
                          {loja.loja_nome} <span className="text-gray-400 text-xs">{loja.loja_codigo}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-400">—</td>
                        <td className="px-3 py-2 text-right">{loja.quantidade_distribuida}</td>
                        <td className="px-3 py-2 text-right text-orange-600">{loja.quantidade_distribuida - loja.saldo_disponivel}</td>
                        <td className="px-3 py-2 text-right text-green-700 font-semibold">{loja.saldo_disponivel}</td>
                        <td className="px-3 py-2 text-right text-gray-400">—</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulários de redistribuição */}
      {cat && (
        <div className="grid grid-cols-2 gap-6">
          {/* Entre Lojas */}
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="font-semibold mb-4">Transferir entre Lojas</h2>
            {okLoja && <p className="text-green-600 text-sm mb-3">Transferência realizada com sucesso.</p>}
            {erroLoja && <p className="text-red-600 text-sm mb-3">{erroLoja}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Loja Origem (com saldo)</label>
                <select className="input text-sm w-full" value={lojaOrigem} onChange={(e) => setLojaOrigem(e.target.value)}>
                  <option value="">Selecione...</option>
                  {lojasComSaldo.map((l) => (
                    <option key={l.loja_id} value={l.loja_id}>{l.loja_nome} — saldo: {l.saldo_disponivel}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Loja Destino</label>
                <select className="input text-sm w-full" value={lojaDestino} onChange={(e) => setLojaDestino(e.target.value)}>
                  <option value="">Selecione...</option>
                  {todasLojas.map((l) => (
                    <option key={l.loja_id} value={l.loja_id}>{l.loja_nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Quantidade</label>
                <input type="number" min={1} className="input text-sm w-full" value={qtdLoja}
                  onChange={(e) => setQtdLoja(e.target.value)} placeholder="Ex: 5" />
              </div>
              <button onClick={transferirLojas}
                className="w-full bg-accent text-white py-2 rounded-lg text-sm font-medium hover:bg-red-800 transition-colors">
                Transferir
              </button>
            </div>
          </div>

          {/* Entre Regioes */}
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="font-semibold mb-4">Transferir entre Regiões</h2>
            <p className="text-xs text-gray-500 mb-3">
              Só é possível transferir a cota <strong>não alocada a lojas</strong> de uma região.
            </p>
            {okReg && <p className="text-green-600 text-sm mb-3">Transferência realizada com sucesso.</p>}
            {erroReg && <p className="text-red-600 text-sm mb-3">{erroReg}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Região Origem (com cota livre)</label>
                <select className="input text-sm w-full" value={regOrigem} onChange={(e) => { setRegOrigem(e.target.value); setQtdReg(''); }}>
                  <option value="">Selecione...</option>
                  {regioesComLivre.map((r) => (
                    <option key={r.regiao_id} value={r.regiao_id}>{r.regiao_nome} — livre: {cotaLivre(r)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Região Destino</label>
                <select className="input text-sm w-full" value={regDestino} onChange={(e) => setRegDestino(e.target.value)}>
                  <option value="">Selecione...</option>
                  {cat.regioes.map((r) => (
                    <option key={r.regiao_id} value={r.regiao_id}>{r.regiao_nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Quantidade{maxReg !== null && <span className="text-gray-400 ml-1">(máx: {maxReg})</span>}
                </label>
                <input type="number" min={1} max={maxReg ?? undefined} className="input text-sm w-full" value={qtdReg}
                  onChange={(e) => setQtdReg(e.target.value)} placeholder="Ex: 10" />
              </div>
              <button onClick={transferirRegioes}
                className="w-full bg-accent text-white py-2 rounded-lg text-sm font-medium hover:bg-red-800 transition-colors">
                Transferir
              </button>
            </div>
          </div>
        </div>
      )}

      {!cat && campanhaId && detalhe && (
        <p className="text-gray-400 text-center py-10">Selecione uma categoria para ver a distribuição.</p>
      )}
      {!campanhaId && (
        <p className="text-gray-400 text-center py-10">Selecione uma campanha ativa para começar.</p>
      )}
    </div>
  );
}
