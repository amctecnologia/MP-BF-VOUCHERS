import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { pool } from '../config/database';

async function buscarLancamentos(filtros: Record<string, unknown>) {
  const conditions: string[] = [];
  const params: unknown[]    = [];
  const add = (cond: string, val: unknown) => { params.push(val); conditions.push(`${cond} = $${params.length}`); };
  const addGte = (col: string, val: unknown) => { params.push(val); conditions.push(`${col} >= $${params.length}`); };
  const addLte = (col: string, val: unknown) => { params.push(val); conditions.push(`${col} <= $${params.length}`); };

  if (filtros.campanha_id)  add('cc.campanha_id', filtros.campanha_id);
  if (filtros.categoria_id) add('cc.categoria_id', filtros.categoria_id);
  if (filtros.loja_id)      add('vu.loja_id', filtros.loja_id);
  if (filtros.status)       add('vu.status', filtros.status);
  if (filtros.data_inicio)  addGte('vu.data_venda', filtros.data_inicio);
  if (filtros.data_fim)     addLte('vu.data_venda', filtros.data_fim);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`
    SELECT vu.id, camp.nome AS campanha, cat.nome AS categoria, cat.codigo,
           l.nome AS loja, l.codigo_loja,
           vu.nome_cliente, vu.cpf_cliente, vu.numero_nota_fiscal,
           vu.data_venda, vu.quantidade_pneus_vendidos, vu.quantidade_vouchers_aplicados,
           vu.valor_desconto_unitario, vu.valor_desconto_total,
           vu.status, vu.observacao_admin, vu.criado_em, u.nome AS usuario
    FROM voucher_usages vu
    JOIN campanha_categorias cc ON vu.campanha_categoria_id = cc.id
    JOIN categorias cat          ON cc.categoria_id = cat.id
    JOIN campanhas camp          ON cc.campanha_id = camp.id
    JOIN lojas l                 ON vu.loja_id = l.id
    JOIN users u                 ON vu.usuario_id = u.id
    ${where}
    ORDER BY vu.data_venda DESC, vu.criado_em DESC
  `, params);
  return rows;
}

export async function exportarLancamentos(req: Request, res: Response): Promise<void> {
  const rows = await buscarLancamentos(req.query);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Lançamentos');

  ws.columns = [
    { header: 'ID',            key: 'id',                        width: 8  },
    { header: 'Campanha',      key: 'campanha',                  width: 30 },
    { header: 'Categoria',     key: 'categoria',                 width: 30 },
    { header: 'Cód. Categ.',   key: 'codigo',                    width: 15 },
    { header: 'Loja',          key: 'loja',                      width: 25 },
    { header: 'Cód. Loja',     key: 'codigo_loja',               width: 12 },
    { header: 'Cliente',       key: 'nome_cliente',              width: 30 },
    { header: 'CPF',           key: 'cpf_cliente',               width: 15 },
    { header: 'Nota Fiscal',   key: 'numero_nota_fiscal',        width: 15 },
    { header: 'Data Venda',    key: 'data_venda',                width: 12 },
    { header: 'Qtd. Pneus',    key: 'quantidade_pneus_vendidos', width: 12 },
    { header: 'Qtd. Vouchers', key: 'quantidade_vouchers_aplicados', width: 14 },
    { header: 'Valor Unit. R$',key: 'valor_desconto_unitario',   width: 14 },
    { header: 'Total R$',      key: 'valor_desconto_total',      width: 14 },
    { header: 'Status',        key: 'status',                    width: 12 },
    { header: 'Usuário',       key: 'usuario',                   width: 25 },
    { header: 'Criado em',     key: 'criado_em',                 width: 20 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D2D2D' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rows.forEach((r) => ws.addRow(r));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="lancamentos.xlsx"');
  await wb.xlsx.write(res);
}

export async function saldoPorCategoria(req: Request, res: Response): Promise<void> {
  const { campanha_id } = req.query;
  const params: unknown[] = [];
  const where = campanha_id ? (params.push(campanha_id), `WHERE cc.campanha_id = $1`) : '';

  const { rows } = await pool.query(`
    SELECT camp.nome AS campanha, cat.nome AS categoria, cat.codigo,
           SUM(ccl.quantidade_distribuida)::int AS total_distribuido,
           SUM(ccl.saldo_disponivel)::int AS total_saldo,
           (SUM(ccl.quantidade_distribuida) - SUM(ccl.saldo_disponivel))::int AS total_usado,
           cc.valor_desconto,
           (SUM(ccl.quantidade_distribuida) - SUM(ccl.saldo_disponivel)) * cc.valor_desconto AS valor_total_usado
    FROM campanha_categoria_lojas ccl
    JOIN campanha_categorias cc ON ccl.campanha_categoria_id = cc.id
    JOIN categorias cat          ON cc.categoria_id = cat.id
    JOIN campanhas camp          ON cc.campanha_id = camp.id
    ${where}
    GROUP BY camp.nome, cat.nome, cat.codigo, cc.valor_desconto
    ORDER BY camp.nome, cat.nome
  `, params);
  res.json(rows);
}
