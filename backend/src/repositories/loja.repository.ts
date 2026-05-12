import { pool } from '../config/database';

export async function listar() {
  const { rows } = await pool.query(`
    SELECT l.id, l.nome, l.codigo_loja, l.regiao_id, l.ativa, r.nome AS regiao_nome
    FROM lojas l JOIN regioes r ON l.regiao_id = r.id
    ORDER BY r.nome, l.nome
  `);
  return rows;
}

export async function listarRegioes() {
  const { rows } = await pool.query(`SELECT * FROM regioes ORDER BY nome`);
  return rows;
}

export async function criar(data: { nome: string; codigo_loja: string; regiao_id: number }) {
  const { rows } = await pool.query(
    `INSERT INTO lojas (nome, codigo_loja, regiao_id) VALUES ($1, $2, $3) RETURNING *`,
    [data.nome, data.codigo_loja, data.regiao_id]
  );
  return rows[0];
}

export async function atualizar(id: number, data: Partial<{ nome: string; regiao_id: number; ativa: boolean }>) {
  const { rows } = await pool.query(
    `UPDATE lojas SET nome=COALESCE($2,nome), regiao_id=COALESCE($3,regiao_id),
     ativa=COALESCE($4,ativa) WHERE id=$1 RETURNING *`,
    [id, data.nome, data.regiao_id, data.ativa]
  );
  if (!rows.length) throw new Error('Loja não encontrada');
  return rows[0];
}

export async function remover(id: number) {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM campanha_categoria_lojas WHERE loja_id = $1) AS distribuicoes,
      (SELECT COUNT(*) FROM voucher_usages           WHERE loja_id = $1) AS lancamentos
  `, [id]);

  const { distribuicoes, lancamentos } = rows[0];
  if (Number(distribuicoes) > 0 || Number(lancamentos) > 0) {
    throw new Error('Loja possui distribuições ou lançamentos e não pode ser excluída');
  }

  const { rowCount } = await pool.query(`DELETE FROM lojas WHERE id = $1`, [id]);
  if (!rowCount) throw new Error('Loja não encontrada');
}
