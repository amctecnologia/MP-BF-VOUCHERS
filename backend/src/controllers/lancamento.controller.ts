import { Request, Response } from 'express';
import path from 'path';
import { pool } from '../config/database';
import { debitarSaldo, estornarSaldo } from '../services/saldo.service';

export async function listar(req: Request, res: Response): Promise<void> {
  const { campanha_id, loja_id, status, categoria_id, data_inicio, data_fim } = req.query;
  const user = req.user!;

  const conditions: string[] = [];
  const params: unknown[]    = [];

  if (user.perfil === 'VENDAS') {
    params.push(user.loja_id);
    conditions.push(`vu.loja_id = $${params.length}`);
    params.push(user.id);
    conditions.push(`vu.usuario_id = $${params.length}`);
  }
  if (campanha_id) { params.push(campanha_id); conditions.push(`cc.campanha_id = $${params.length}`); }
  if (loja_id)     { params.push(loja_id);     conditions.push(`vu.loja_id = $${params.length}`); }
  if (categoria_id){ params.push(categoria_id); conditions.push(`cc.categoria_id = $${params.length}`); }
  if (status)      { params.push(status);       conditions.push(`vu.status = $${params.length}`); }
  if (data_inicio) { params.push(data_inicio);  conditions.push(`vu.data_venda >= $${params.length}`); }
  if (data_fim)    { params.push(data_fim);      conditions.push(`vu.data_venda <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT vu.*,
           cat.nome  AS categoria_nome,
           cat.codigo AS categoria_codigo,
           camp.nome AS campanha_nome,
           l.nome    AS loja_nome,
           u.nome    AS usuario_nome
    FROM voucher_usages vu
    JOIN campanha_categorias cc ON vu.campanha_categoria_id = cc.id
    JOIN categorias cat          ON cc.categoria_id = cat.id
    JOIN campanhas camp          ON cc.campanha_id = camp.id
    JOIN lojas l                 ON vu.loja_id = l.id
    JOIN users u                 ON vu.usuario_id = u.id
    ${where}
    ORDER BY vu.criado_em DESC
    LIMIT 500
  `, params);

  res.json(rows);
}

export async function contarPendentes(_req: Request, res: Response): Promise<void> {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS total FROM voucher_usages WHERE status='PENDENTE'`);
  res.json({ total: rows[0].total });
}

export async function criar(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const {
    campanha_categoria_id, nome_cliente, cpf_cliente,
    numero_nota_fiscal, data_venda,
    quantidade_pneus_vendidos, quantidade_vouchers_aplicados,
  } = req.body;

  const anexo = (req.file as Express.Multer.File | undefined)?.filename
    ? path.basename((req.file as Express.Multer.File).filename)
    : null;

  if (!anexo) { res.status(400).json({ error: 'Anexo da nota fiscal é obrigatório' }); return; }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Busca valor do desconto + valida campanha ativa + valida período
    const { rows: [cc] } = await client.query(`
      SELECT cc.id, cc.valor_desconto, cc.campanha_id,
             camp.status AS camp_status, camp.data_inicio, camp.data_fim
      FROM campanha_categorias cc
      JOIN campanhas camp ON cc.campanha_id = camp.id
      WHERE cc.id = $1
    `, [campanha_categoria_id]);

    if (!cc) { throw new Error('Categoria de campanha não encontrada'); }
    if (cc.camp_status !== 'ATIVA') { throw new Error('Campanha não está ativa'); }
    if (data_venda < cc.data_inicio || data_venda > cc.data_fim) {
      throw new Error('Data de venda fora do período da campanha');
    }

    const qtd   = Number(quantidade_vouchers_aplicados);
    const valor = Number(cc.valor_desconto);

    await debitarSaldo(client, cc.id, user.loja_id!, qtd);

    const { rows: [lancamento] } = await client.query(`
      INSERT INTO voucher_usages (
        campanha_categoria_id, loja_id, usuario_id,
        nome_cliente, cpf_cliente, numero_nota_fiscal, data_venda,
        quantidade_pneus_vendidos, quantidade_vouchers_aplicados,
        valor_desconto_unitario, valor_desconto_total, anexo_nota_fiscal
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [
      cc.id, user.loja_id, user.id,
      nome_cliente, cpf_cliente || null, numero_nota_fiscal, data_venda,
      quantidade_pneus_vendidos, qtd,
      valor, qtd * valor, anexo,
    ]);

    await client.query('COMMIT');
    res.status(201).json(lancamento);
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const msg = err instanceof Error ? err.message : 'Erro interno';
    res.status(400).json({ error: msg });
  } finally {
    client.release();
  }
}

export async function validar(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { observacao } = req.body;
  const { rows } = await pool.query(`
    UPDATE voucher_usages
    SET status='VALIDADO', observacao_admin=$2, atualizado_em=NOW(), atualizado_por=$3
    WHERE id=$1 AND status='PENDENTE' RETURNING *
  `, [id, observacao || null, req.user!.id]);
  if (!rows.length) { res.status(404).json({ error: 'Lançamento não encontrado ou não está pendente' }); return; }
  await pool.query(`INSERT INTO log_auditoria (entidade,entidade_id,acao,usuario_id) VALUES ('voucher_usages',$1,'VALIDOU',$2)`, [id, req.user!.id]);
  res.json(rows[0]);
}

export async function cancelar(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { observacao } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      UPDATE voucher_usages
      SET status='CANCELADO', observacao_admin=$2, atualizado_em=NOW(), atualizado_por=$3
      WHERE id=$1 AND status IN ('PENDENTE','VALIDADO') RETURNING *
    `, [id, observacao || null, req.user!.id]);
    if (!rows.length) throw new Error('Lançamento não encontrado ou já cancelado');
    const l = rows[0];
    await estornarSaldo(l.campanha_categoria_id, l.loja_id, l.quantidade_vouchers_aplicados);
    await client.query(`INSERT INTO log_auditoria (entidade,entidade_id,acao,usuario_id) VALUES ('voucher_usages',$1,'CANCELOU',$2)`, [id, req.user!.id]);
    await client.query('COMMIT');
    res.json(l);
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro interno' });
  } finally {
    client.release();
  }
}
