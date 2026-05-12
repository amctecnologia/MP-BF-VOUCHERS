export type PerfilUsuario  = 'ADMIN' | 'VENDAS';
export type StatusCampanha = 'RASCUNHO' | 'ATIVA' | 'ENCERRADA' | 'CANCELADA';
export type StatusLancamento = 'PENDENTE' | 'VALIDADO' | 'CANCELADO';

export interface AuthUser {
  id?: number;
  ad_username: string;
  nome: string;
  perfil: PerfilUsuario;
  loja_id: number | null;
  token: string;
}

export interface Regiao     { id: number; nome: string; }
export interface Loja       { id: number; nome: string; codigo_loja: string; cidade: string; estado: string; regiao_id: number; regiao_nome: string; ativa: boolean; }
export interface Categoria  { id: number; nome: string; codigo: string; descricao?: string; ativa: boolean; }
export interface Campanha   { id: number; nome: string; descricao?: string; data_inicio: string; data_fim: string; status: StatusCampanha; total_categorias: number; }

export interface DistribuicaoLoja {
  id?: number; loja_id: number; loja_nome: string; loja_codigo: string;
  quantidade_distribuida: number; saldo_disponivel: number;
}
export interface DistribuicaoRegiao {
  id?: number; regiao_id: number; regiao_nome: string;
  quantidade_regional: number; lojas: DistribuicaoLoja[];
}
export interface CampanhaCategoria {
  id: number; categoria_id: number; categoria_nome: string; categoria_codigo: string;
  valor_desconto: number; quantidade_total: number; status: string;
  regioes: DistribuicaoRegiao[];
}
export interface CampanhaDetalhe extends Campanha { categorias: CampanhaCategoria[]; }

export interface SaldoLoja {
  campanha_categoria_id: number; categoria_nome: string; categoria_codigo: string;
  valor_desconto: number; saldo_disponivel: number; quantidade_distribuida: number;
  campanha_nome: string; data_inicio: string; data_fim: string;
}

export interface Lancamento {
  id: number; campanha_nome: string; categoria_nome: string; categoria_codigo: string;
  loja_nome: string; usuario_nome: string; nome_cliente: string; cpf_cliente?: string;
  numero_nota_fiscal: string; data_venda: string;
  quantidade_pneus_vendidos: number; quantidade_vouchers_aplicados: number;
  valor_desconto_unitario: number; valor_desconto_total: number;
  anexo_nota_fiscal?: string; status: StatusLancamento;
  observacao_admin?: string; criado_em: string;
}

export interface Usuario {
  id: number; ad_username: string; nome: string; email?: string;
  perfil: PerfilUsuario; status: string; loja_nome?: string; loja_id?: number;
}
