import { Request, Response, NextFunction } from 'express';
import { PerfilUsuario } from '../types';

export function authorize(...perfis: PerfilUsuario[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !perfis.includes(req.user.perfil)) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    next();
  };
}
