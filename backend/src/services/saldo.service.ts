import { PoolClient } from 'pg';
import { pool } from '../config/database';

export async function debitarSaldo(
  client: PoolClient,
  campanhaCategoriaId: number,
  lojaId: number,
  quantidade: number
): Promise<void> {
  const { rowCount } = await client.query(`
    UPDATE campanha_categoria_lojas
    SET saldo_disponivel = saldo_disponivel - $3,
        atualizado_em   = NOW()
    WHERE campanha_categoria_id = $1
      AND loja_id               = $2
      AND saldo_disponivel      >= $3
  `, [campanhaCategoriaId, lojaId, quantidade]);

  if (!rowCount) {
    throw new Error('Saldo insuficiente para esta categoria/loja');
  }
}

export async function estornarSaldo(
  campanhaCategoriaId: number,
  lojaId: number,
  quantidade: number
): Promise<void> {
  await pool.query(`
    UPDATE campanha_categoria_lojas
    SET saldo_disponivel = saldo_disponivel + $3,
        atualizado_em   = NOW()
    WHERE campanha_categoria_id = $1 AND loja_id = $2
  `, [campanhaCategoriaId, lojaId, quantidade]);
}

export async function redistribuir(
  campanhaCategoriaId: number,
  lojaOrigemId: number,
  lojaDestinoId: number,
  quantidade: number,
  usuarioId: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Reduz origem (validando que saldo disponível é suficiente)
    const { rowCount } = await client.query(`
      UPDATE campanha_categoria_lojas
      SET quantidade_distribuida = quantidade_distribuida - $3,
          saldo_disponivel       = saldo_disponivel - $3,
          atualizado_em          = NOW()
      WHERE campanha_categoria_id = $1
        AND loja_id               = $2
        AND saldo_disponivel      >= $3
    `, [campanhaCategoriaId, lojaOrigemId, quantidade]);

    if (!rowCount) throw new Error('Saldo insuficiente na loja de origem para redistribuição');

    // Aumenta destino (upsert)
    await client.query(`
      INSERT INTO campanha_categoria_lojas
        (campanha_categoria_id, loja_id, quantidade_distribuida, saldo_disponivel)
      VALUES ($1, $2, $3, $3)
      ON CONFLICT (campanha_categoria_id, loja_id) DO UPDATE
        SET quantidade_distribuida = campanha_categoria_lojas.quantidade_distribuida + $3,
            saldo_disponivel       = campanha_categoria_lojas.saldo_disponivel + $3,
            atualizado_em          = NOW()
    `, [campanhaCategoriaId, lojaDestinoId, quantidade]);

    await client.query(`
      INSERT INTO log_auditoria (entidade, entidade_id, acao, usuario_id, detalhe)
      VALUES ('campanha_categoria_lojas', $1, 'REDISTRIBUIU', $2, $3::jsonb)
    `, [campanhaCategoriaId, usuarioId, JSON.stringify({ lojaOrigemId, lojaDestinoId, quantidade })]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
