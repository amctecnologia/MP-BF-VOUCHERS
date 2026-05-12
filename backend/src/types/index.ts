export type PerfilUsuario = 'ADMIN' | 'VENDAS';
export type StatusUsuario = 'PENDENTE_APROVACAO' | 'ATIVO' | 'INATIVO';
export type StatusCampanha = 'RASCUNHO' | 'ATIVA' | 'ENCERRADA' | 'CANCELADA';
export type StatusLancamento = 'PENDENTE' | 'VALIDADO' | 'CANCELADO';

export interface JwtPayload {
  sub: number;
  ad_username: string;
  nome: string;
  perfil: PerfilUsuario;
  loja_id: number | null;
}

export interface RequestUser {
  id: number;
  ad_username: string;
  nome: string;
  perfil: PerfilUsuario;
  loja_id: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}
