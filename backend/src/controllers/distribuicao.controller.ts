import { Request, Response } from 'express';
import { redistribuir, redistribuirRegional } from '../services/saldo.service';

export async function redistribuirSaldo(req: Request, res: Response): Promise<void> {
  try {
    const { campanha_categoria_id, loja_origem_id, loja_destino_id, quantidade } = req.body;
    await redistribuir(campanha_categoria_id, loja_origem_id, loja_destino_id, quantidade, req.user!.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro interno' });
  }
}

export async function redistribuirSaldoRegional(req: Request, res: Response): Promise<void> {
  try {
    const { campanha_categoria_id, regiao_origem_id, regiao_destino_id, quantidade } = req.body;
    await redistribuirRegional(campanha_categoria_id, regiao_origem_id, regiao_destino_id, quantidade, req.user!.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro interno' });
  }
}
