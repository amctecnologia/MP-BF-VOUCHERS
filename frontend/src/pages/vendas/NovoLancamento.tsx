import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { SaldoLoja } from '../../types';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ACCEPT = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const ACCEPT_EXT = '.pdf,.jpg,.jpeg,.png';
const MAX_MB = 10;

export default function NovoLancamento() {
  const { campanha_categoria_id } = useParams<{ campanha_categoria_id: string }>();
  const nav = useNavigate();

  const [info, setInfo]       = useState<SaldoLoja | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  const [form, setForm] = useState({
    nome_cliente: '', cpf_cliente: '',
    numero_nota_fiscal: '', data_venda: '',
    quantidade_pneus_vendidos: '', quantidade_vouchers_aplicados: '',
  });
  const [arquivo, setArquivo]   = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/campanhas/saldo/loja')
      .then((r: { data: SaldoLoja[] }) => {
        const item = r.data.find((x) => String(x.campanha_categoria_id) === campanha_categoria_id);
        setInfo(item || null);
        if (!item) setError('Categoria não encontrada ou sem distribuição para sua loja.');
      })
      .catch(() => setError('Erro ao carregar informações da categoria.'))
      .finally(() => setLoading(false));
  }, [campanha_categoria_id]);

  const qtdVouchers   = Number(form.quantidade_vouchers_aplicados) || 0;
  const valorTotal    = info ? qtdVouchers * info.valor_desconto : 0;
  const saldoOk       = info ? qtdVouchers > 0 && qtdVouchers <= info.saldo_disponivel : false;

  function handleFile(file: File | null) {
    if (!file) { setArquivo(null); setFileError(''); return; }
    if (!ACCEPT.includes(file.type)) { setFileError('Formato inválido. Use PDF, JPG ou PNG.'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setFileError(`Arquivo muito grande. Máximo ${MAX_MB}MB.`); return; }
    setArquivo(file);
    setFileError('');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0] || null);
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!info) return;
    if (!arquivo) { setError('Anexo da nota fiscal é obrigatório.'); return; }
    if (!saldoOk) { setError(`Quantidade inválida. Saldo disponível: ${info.saldo_disponivel}`); return; }

    setSaving(true); setError('');
    const fd = new FormData();
    fd.append('campanha_categoria_id', String(campanha_categoria_id));
    fd.append('nome_cliente', form.nome_cliente);
    if (form.cpf_cliente) fd.append('cpf_cliente', form.cpf_cliente);
    fd.append('numero_nota_fiscal', form.numero_nota_fiscal);
    fd.append('data_venda', form.data_venda);
    fd.append('quantidade_pneus_vendidos', form.quantidade_pneus_vendidos);
    fd.append('quantidade_vouchers_aplicados', form.quantidade_vouchers_aplicados);
    fd.append('anexo_nota_fiscal', arquivo);

    try {
      await api.post('/lancamentos', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Erro ao registrar lançamento.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Carregando...</div>;

  if (success) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="bg-green-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-primary">Lançamento registrado!</h2>
        <p className="text-gray-500 text-sm">
          Seu uso de vouchers foi registrado com status <strong>Pendente</strong>.
          O administrador irá validar o lançamento em breve.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => nav('/vendas')} className="btn-primary">
            Voltar ao início
          </button>
          <button
            onClick={() => {
              setSuccess(false);
              setForm({ nome_cliente: '', cpf_cliente: '', numero_nota_fiscal: '', data_venda: '', quantidade_pneus_vendidos: '', quantidade_vouchers_aplicados: '' });
              setArquivo(null);
            }}
            className="btn-secondary"
          >
            Novo lançamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => nav(-1)} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-primary">Registrar Uso de Vouchers</h1>
          {info && <p className="text-sm text-gray-500">{info.campanha_nome}</p>}
        </div>
      </div>

      {/* Info da categoria */}
      {info && (
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-primary">{info.categoria_nome}</p>
            <p className="text-xs text-gray-500 font-mono">{info.categoria_codigo}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Valor por voucher</p>
            <p className="text-xl font-bold text-accent">{fmt(info.valor_desconto)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Saldo: <strong>{info.saldo_disponivel}</strong></p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {info && (
        <form onSubmit={submit} className="space-y-5">
          {/* Dados do cliente */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-700 mb-2">Dados do Cliente</legend>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome do cliente *</label>
              <input className="input" required value={form.nome_cliente} onChange={set('nome_cliente')} placeholder="Nome completo" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CPF do cliente <span className="text-gray-400">(opcional)</span></label>
              <input className="input" value={form.cpf_cliente} onChange={set('cpf_cliente')} placeholder="000.000.000-00" />
            </div>
          </fieldset>

          {/* Dados da venda */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-gray-700 mb-2">Dados da Venda</legend>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nº da nota fiscal *</label>
                <input className="input" required value={form.numero_nota_fiscal} onChange={set('numero_nota_fiscal')} placeholder="ex: 000123" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data da venda *</label>
                <input
                  type="date" className="input" required
                  value={form.data_venda} onChange={set('data_venda')}
                  min={info.data_inicio} max={info.data_fim}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Qtd. pneus vendidos *</label>
                <input
                  type="number" min={1} className="input" required
                  value={form.quantidade_pneus_vendidos}
                  onChange={set('quantidade_pneus_vendidos')}
                  placeholder="ex: 4"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Qtd. vouchers aplicados *
                  <span className="ml-1 text-gray-400">(máx: {info.saldo_disponivel})</span>
                </label>
                <input
                  type="number" min={1} max={info.saldo_disponivel} className="input" required
                  value={form.quantidade_vouchers_aplicados}
                  onChange={set('quantidade_vouchers_aplicados')}
                  placeholder="ex: 2"
                />
              </div>
            </div>
          </fieldset>

          {/* Totalizador automático */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Valor do voucher</p>
              <p className="font-medium">{fmt(info.valor_desconto)} <span className="text-gray-400 text-xs">× {qtdVouchers || '—'}</span></p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total de desconto</p>
              <p className={`text-2xl font-bold ${valorTotal > 0 ? 'text-accent' : 'text-gray-300'}`}>
                {valorTotal > 0 ? fmt(valorTotal) : '—'}
              </p>
            </div>
          </div>

          {/* Upload nota fiscal */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Nota fiscal (PDF, JPG, PNG — máx {MAX_MB}MB) *</label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                arquivo ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-accent hover:bg-accent/5'
              }`}
            >
              <input
                ref={fileRef} type="file" accept={ACCEPT_EXT} className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
              {arquivo ? (
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">{arquivo.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setArquivo(null); }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-6 h-6 mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500">Arraste o arquivo ou clique para selecionar</p>
                  <p className="text-xs text-gray-400">PDF, JPG, PNG — máximo {MAX_MB}MB</p>
                </div>
              )}
            </div>
            {fileError && <p className="text-xs text-red-600 mt-1">{fileError}</p>}
          </div>

          {/* Aviso saldo */}
          {qtdVouchers > info.saldo_disponivel && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Saldo insuficiente. Disponível: {info.saldo_disponivel} voucher(s).
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => nav(-1)} className="btn-secondary flex-1 justify-center">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !saldoOk || !arquivo}
              className="btn-primary flex-2 flex-1 justify-center"
            >
              {saving ? 'Registrando...' : 'Registrar Uso'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
