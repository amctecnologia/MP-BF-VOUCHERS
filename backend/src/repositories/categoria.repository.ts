import { pool } from '../config/database';

export async function listar(apenasAtivas = false) {
  const where = apenasAtivas ? 'WHERE ativa = TRUE' : '';
  const { rows } = await pool.query(`SELECT * FROM categorias ${where} ORDER BY nome`);
  return rows;
}

export async function criar(data: { nome: string; codigo: string; descricao?: string }) {
  const { rows } = await pool.query(
    `INSERT INTO categorias (nome, codigo, descricao) VALUES ($1,$2,$3) RETURNING *`,
    [data.nome, data.codigo, data.descricao || null]
  );
  return rows[0];
}

export async function atualizar(id: number, data: { nome?: string; descricao?: string; ativa?: boolean }) {
  const { rows } = await pool.query(
    `UPDATE categorias SET nome=COALESCE($2,nome), descricao=COALESCE($3,descricao), ativa=COALESCE($4,ativa)
     WHERE id=$1 RETURNING *`,
    [id, data.nome, data.descricao, data.ativa]
  );
  if (!rows.length) throw new Error('Categoria não encontrada');
  return rows[0];
}
