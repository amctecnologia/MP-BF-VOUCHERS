import { Request, Response } from 'express';
import { login } from '../services/auth.service';

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'username e password são obrigatórios' });
    return;
  }
  try {
    const result = await login(username, password);
    if ('pendente' in result) {
      res.status(202).json({ pendente: true, message: 'Acesso em análise. Aguarde a liberação pelo administrador.' });
      return;
    }
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    res.status(401).json({ error: msg });
  }
}
