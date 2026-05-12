import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }
  try {
    const payload = jwt.verify(
      header.slice(7),
      process.env.JWT_SECRET || 'secret'
    ) as JwtPayload;
    req.user = {
      id:          payload.sub,
      ad_username: payload.ad_username,
      nome:        payload.nome,
      perfil:      payload.perfil,
      loja_id:     payload.loja_id,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
