import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { authenticateUser, isInGroup } from '../config/ldap';
import { PerfilUsuario, JwtPayload } from '../types';

const GROUP_ADMIN  = process.env.LDAP_GROUP_ADMIN  || 'BF-VC-ADMIN';
const GROUP_VENDAS = process.env.LDAP_GROUP_VENDAS || 'BF-VC-VENDAS';

export async function login(username: string, password: string) {
  const ldapUser = await authenticateUser(username, password);
  if (!ldapUser) throw new Error('Credenciais inválidas');

  const isAdmin  = isInGroup(ldapUser.memberOf, GROUP_ADMIN);
  const isVendas = isInGroup(ldapUser.memberOf, GROUP_VENDAS);

  if (!isAdmin && !isVendas) {
    throw new Error('Usuário sem permissão de acesso ao sistema');
  }

  const perfil: PerfilUsuario = isAdmin ? 'ADMIN' : 'VENDAS';
  // Calcula status no JS para evitar ambiguidade de tipo ENUM no PostgreSQL
  const statusInicial = perfil === 'ADMIN' ? 'ATIVO' : 'PENDENTE_APROVACAO';

  const { rows } = await pool.query<{
    id: number; loja_id: number | null; status: string;
  }>(`
    INSERT INTO users (ad_username, nome, email, perfil, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (ad_username) DO UPDATE
      SET nome          = EXCLUDED.nome,
          email         = EXCLUDED.email,
          perfil        = EXCLUDED.perfil,
          atualizado_em = NOW()
    RETURNING id, loja_id, status
  `, [ldapUser.sAMAccountName, ldapUser.displayName, ldapUser.mail, perfil, statusInicial]);

  const user = rows[0];

  if (perfil === 'VENDAS' && user.status === 'PENDENTE_APROVACAO') {
    return { pendente: true };
  }
  if (perfil === 'VENDAS' && user.status === 'INATIVO') {
    throw new Error('Usuário inativo');
  }

  const payload: JwtPayload = {
    sub:         user.id,
    ad_username: ldapUser.sAMAccountName,
    nome:        ldapUser.displayName,
    perfil,
    loja_id:     user.loja_id,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', {
    expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'],
  });

  return { token, perfil, loja_id: user.loja_id, nome: ldapUser.displayName };
}
