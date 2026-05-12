import { pool } from '../config/database';

export async function listar() {
  const { rows } = await pool.query(`
    SELECT l.*, r.nome AS regiao_nome
    FROM lojas l JOIN regioes r ON l.regiao_id = r.id
    ORDER BY r.nome, l.nome
  `);
  return rows;
}

export async function listarRegioes() {
  const { rows } = await pool.query(`SELECT * FROM regioes ORDER BY nome`);
  return rows;
}

export async function criar(data: { nome: string; codigo_loja: string; cidade: string; estado: string; regiao_id: number }) {
  const { rows } = await pool.query(
    `INSERT INTO lojas (nome,codigo_loja,cidade,estado,regiao_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.nome, data.codigo_loja, data.cidade, data.estado, data.regiao_id]
  );
  return rows[0];
}

export async function atualizar(id: number, data: Partial<{ nome: string; cidade: string; estado: string; regiao_id: number; ativa: boolean }>) {
  const { rows } = await pool.query(
    `UPDATE lojas SET nome=COALESCE($2,nome), cidade=COALESCE($3,cidade), estado=COALESCE($4,estado),
     regiao_id=COALESCE($5,regiao_id), ativa=COALESCE($6,ativa) WHERE id=$1 RETURNING *`,
    [id, data.nome, data.cidade, data.estado, data.regiao_id, data.ativa]
  );
  if (!rows.length) throw new Error('Loja não encontrada');
  return rows[0];
}
