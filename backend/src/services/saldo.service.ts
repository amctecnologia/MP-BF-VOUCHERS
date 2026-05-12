import { PoolClient } from 'pg';
import { pool } from '../config/database';

export async function redistribuirRegional(
  campanhaCategoriaId: number,
  regiaoOrigemId: number,
  regiaoDestinoId: number,
  quantidade: number,
  usuarioId: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Calcula cota não alocada da origem (quantidade_regional - distribuído às lojas)
    const { rows } = await client.query(`
      SELECT ccr.quantidade_regional,
             COALESCE(SUM(ccl.quantidade_distribuida), 0)::int AS alocado
      FROM campanha_categoria_regioes ccr
      LEFT JOIN lojas l ON l.regiao_id = ccr.regiao_id
      LEFT JOIN campanha_categoria_lojas ccl
             ON ccl.campanha_categoria_id = ccr.campanha_categoria_id
            AND ccl.loja_id = l.id
      WHERE ccr.campanha_categoria_id = $1
        AND ccr.regiao_id = $2
      GROUP BY ccr.quantidade_regional
    `, [campanhaCategoriaId, regiaoOrigemId]);

    if (!rows.length) throw new Error('Região de origem não encontrada nesta categoria');
    const disponivel = rows[0].quantidade_regional - rows[0].alocado;
    if (quantidade > disponivel) {
      throw new Error(`Cota livre na região de origem é ${disponivel} voucher(s) (não alocados a lojas)`);
    }

    await client.query(`
      UPDATE campanha_categoria_regioes
      SET quantidade_regional = quantidade_regional - $3
      WHERE campanha_categoria_id = $1 AND regiao_id = $2
    `, [campanhaCategoriaId, regiaoOrigemId, quantidade]);

    await client.query(`
      UPDATE campanha_categoria_regioes
      SET quantidade_regional = quantidade_regional + $3
      WHERE campanha_categoria_id = $1 AND regiao_id = $2
    `, [campanhaCategoriaId, regiaoDestinoId, quantidade]);

    await client.query(`
      INSERT INTO log_auditoria (entidade, entidade_id, acao, usuario_id, detalhe)
      VALUES ('campanha_categoria_regioes', $1, 'REDISTRIBUIU', $2, $3::jsonb)
    `, [campanhaCategoriaId, usuarioId, JSON.stringify({ regiaoOrigemId, regiaoDestinoId, quantidade })]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

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
