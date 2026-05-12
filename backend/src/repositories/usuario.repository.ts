import { pool } from '../config/database';

export async function listarPendentes() {
  const { rows } = await pool.query(`
    SELECT id, ad_username, nome, email, criado_em
    FROM users WHERE status = 'PENDENTE_APROVACAO' ORDER BY criado_em
  `);
  return rows;
}

export async function aprovarUsuario(id: number, loja_id: number, aprovadoPor: number) {
  const { rowCount } = await pool.query(`
    UPDATE users SET status = 'ATIVO', loja_id = $2, atualizado_em = NOW()
    WHERE id = $1 AND status = 'PENDENTE_APROVACAO'
  `, [id, loja_id]);
  if (!rowCount) throw new Error('Usuário não encontrado ou já aprovado');
  await pool.query(`
    INSERT INTO log_auditoria (entidade, entidade_id, acao, usuario_id)
    VALUES ('users', $1, 'APROVOU', $2)
  `, [id, aprovadoPor]);
}

export async function listarUsuarios() {
  const { rows } = await pool.query(`
    SELECT u.id, u.ad_username, u.nome, u.email, u.perfil, u.status,
           l.nome AS loja_nome, l.codigo_loja
    FROM users u LEFT JOIN lojas l ON u.loja_id = l.id
    ORDER BY u.nome
  `);
  return rows;
}

export async function inativarUsuario(id: number, por: number) {
  await pool.query(`UPDATE users SET status = 'INATIVO', atualizado_em = NOW() WHERE id = $1`, [id]);
  await pool.query(`INSERT INTO log_auditoria (entidade, entidade_id, acao, usuario_id) VALUES ('users', $1, 'EDITOU', $2)`, [id, por]);
}
