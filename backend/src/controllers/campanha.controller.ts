import { Request, Response } from 'express';
import * as repo from '../repositories/campanha.repository';

export async function listar(req: Request, res: Response): Promise<void> {
  const rows = await repo.listar({ status: req.query.status as string });
  res.json(rows);
}

export async function buscar(req: Request, res: Response): Promise<void> {
  const camp = await repo.buscarPorId(Number(req.params.id));
  if (!camp) { res.status(404).json({ error: 'Campanha não encontrada' }); return; }
  res.json(camp);
}

export async function criar(req: Request, res: Response): Promise<void> {
  try {
    const camp = await repo.criar({ ...req.body, criado_por: req.user!.id });
    res.status(201).json(camp);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro interno' });
  }
}

export async function atualizarStatus(req: Request, res: Response): Promise<void> {
  try {
    const camp = await repo.atualizarStatus(Number(req.params.id), req.body.status, req.user!.id);
    res.json(camp);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro interno' });
  }
}

export async function salvarCategoria(req: Request, res: Response): Promise<void> {
  try {
    const { categoria_id, valor_desconto, quantidade_total, regioes } = req.body;
    const id = await repo.salvarCategoriaComDistribuicao(
      Number(req.params.id), categoria_id, valor_desconto, quantidade_total, regioes
    );
    res.status(201).json({ campanha_categoria_id: id });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro interno' });
  }
}

export async function saldoPorLoja(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const lojaId = user.perfil === 'VENDAS' ? user.loja_id : req.query.loja_id;

  const { rows } = await (await import('../config/database')).pool.query(`
    SELECT cc.id AS campanha_categoria_id,
           cat.nome AS categoria_nome, cat.codigo AS categoria_codigo,
           cc.valor_desconto, ccl.saldo_disponivel, ccl.quantidade_distribuida,
           camp.nome AS campanha_nome, camp.data_inicio, camp.data_fim
    FROM campanha_categoria_lojas ccl
    JOIN campanha_categorias cc ON ccl.campanha_categoria_id = cc.id
    JOIN categorias cat          ON cc.categoria_id = cat.id
    JOIN campanhas camp          ON cc.campanha_id = camp.id
    WHERE ccl.loja_id = $1
      AND camp.status = 'ATIVA'
      AND cc.status   = 'ATIVA'
    ORDER BY camp.nome, cat.nome
  `, [lojaId]);
  res.json(rows);
}
