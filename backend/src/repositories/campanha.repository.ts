import { pool } from '../config/database';

export async function listar(filtros?: { status?: string }) {
  const where = filtros?.status ? `WHERE c.status = $1` : '';
  const params = filtros?.status ? [filtros.status] : [];
  const { rows } = await pool.query(`
    SELECT c.*,
           u.nome AS criado_por_nome,
           COUNT(DISTINCT cc.id)::int AS total_categorias
    FROM campanhas c
    LEFT JOIN users u ON c.criado_por = u.id
    LEFT JOIN campanha_categorias cc ON cc.campanha_id = c.id
    ${where}
    GROUP BY c.id, u.nome
    ORDER BY c.criado_em DESC
  `, params);
  return rows;
}

export async function buscarPorId(id: number) {
  const { rows } = await pool.query(`
    SELECT c.*,
           json_agg(
             json_build_object(
               'id', cc.id,
               'categoria_id', cc.categoria_id,
               'categoria_nome', cat.nome,
               'categoria_codigo', cat.codigo,
               'valor_desconto', cc.valor_desconto,
               'quantidade_total', cc.quantidade_total,
               'status', cc.status,
               'regioes', (
                 SELECT json_agg(json_build_object(
                   'id', ccr.id,
                   'regiao_id', ccr.regiao_id,
                   'regiao_nome', r.nome,
                   'quantidade_regional', ccr.quantidade_regional,
                   'lojas', (
                     SELECT json_agg(json_build_object(
                       'id', ccl.id,
                       'loja_id', ccl.loja_id,
                       'loja_nome', l.nome,
                       'loja_codigo', l.codigo_loja,
                       'quantidade_distribuida', ccl.quantidade_distribuida,
                       'saldo_disponivel', ccl.saldo_disponivel
                     )) FROM campanha_categoria_lojas ccl
                     JOIN lojas l ON ccl.loja_id = l.id
                     WHERE ccl.campanha_categoria_id = cc.id AND l.regiao_id = ccr.regiao_id
                   )
                 )) FROM campanha_categoria_regioes ccr
                 JOIN regioes r ON ccr.regiao_id = r.id
                 WHERE ccr.campanha_categoria_id = cc.id
               )
             )
           ) FILTER (WHERE cc.id IS NOT NULL) AS categorias
    FROM campanhas c
    LEFT JOIN campanha_categorias cc ON cc.campanha_id = c.id
    LEFT JOIN categorias cat ON cc.categoria_id = cat.id
    WHERE c.id = $1
    GROUP BY c.id
  `, [id]);
  return rows[0] || null;
}

export async function criar(data: { nome: string; descricao?: string; data_inicio: string; data_fim: string; criado_por: number }) {
  const { rows } = await pool.query(
    `INSERT INTO campanhas (nome, descricao, data_inicio, data_fim, criado_por)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.nome, data.descricao || null, data.data_inicio, data.data_fim, data.criado_por]
  );
  return rows[0];
}

export async function atualizarStatus(id: number, status: string, usuarioId: number) {
  if (status === 'ATIVA') {
    const { rows: [check] } = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM campanha_categoria_lojas ccl
      JOIN campanha_categorias cc ON ccl.campanha_categoria_id = cc.id
      WHERE cc.campanha_id = $1 AND ccl.quantidade_distribuida > 0
    `, [id]);
    if (check.total === 0) {
      throw new Error('A campanha precisa ter ao menos uma categoria com vouchers distribuídos para lojas.');
    }
  }
  const acoes: Record<string, string> = { ATIVA: 'ATIVOU', ENCERRADA: 'ENCERROU', CANCELADA: 'CANCELOU' };
  const { rows } = await pool.query(
    `UPDATE campanhas SET status=$2, atualizado_em=NOW() WHERE id=$1 RETURNING *`, [id, status]
  );
  if (!rows.length) throw new Error('Campanha não encontrada');
  const acao = acoes[status] || 'EDITOU';
  await pool.query(
    `INSERT INTO log_auditoria (entidade, entidade_id, acao, usuario_id) VALUES ('campanhas', $1, $2, $3)`,
    [id, acao, usuarioId]
  );
  return rows[0];
}

export async function salvarCategoriaComDistribuicao(
  campanhaId: number,
  categoriaId: number,
  valorDesconto: number,
  quantidadeTotal: number,
  regioes: Array<{ regiao_id: number; quantidade_regional: number; lojas: Array<{ loja_id: number; quantidade_distribuida: number }> }>
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert CampanhaCategoria
    const { rows: [cc] } = await client.query(`
      INSERT INTO campanha_categorias (campanha_id, categoria_id, valor_desconto, quantidade_total)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (campanha_id, categoria_id) DO UPDATE
        SET valor_desconto=$3, quantidade_total=$4
      RETURNING id
    `, [campanhaId, categoriaId, valorDesconto, quantidadeTotal]);

    // Valida soma das regiões
    const somaRegioes = regioes.reduce((s, r) => s + r.quantidade_regional, 0);
    if (somaRegioes !== quantidadeTotal) {
      throw new Error(`Soma das regiões (${somaRegioes}) deve ser igual ao total (${quantidadeTotal})`);
    }

    // Deleta distribuições anteriores e reinicia
    await client.query(`DELETE FROM campanha_categoria_lojas WHERE campanha_categoria_id=$1`, [cc.id]);
    await client.query(`DELETE FROM campanha_categoria_regioes WHERE campanha_categoria_id=$1`, [cc.id]);

    for (const reg of regioes) {
      await client.query(
        `INSERT INTO campanha_categoria_regioes (campanha_categoria_id, regiao_id, quantidade_regional)
         VALUES ($1,$2,$3)`, [cc.id, reg.regiao_id, reg.quantidade_regional]
      );
      const somaLojas = reg.lojas.reduce((s, l) => s + l.quantidade_distribuida, 0);
      if (somaLojas > reg.quantidade_regional) {
        throw new Error(`Soma das lojas (${somaLojas}) excede a cota regional (${reg.quantidade_regional})`);
      }
      for (const loja of reg.lojas) {
        if (loja.quantidade_distribuida === 0) continue;
        await client.query(
          `INSERT INTO campanha_categoria_lojas (campanha_categoria_id, loja_id, quantidade_distribuida, saldo_disponivel)
           VALUES ($1,$2,$3,$3)`, [cc.id, loja.loja_id, loja.quantidade_distribuida]
        );
      }
    }

    await client.query('COMMIT');
    return cc.id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
