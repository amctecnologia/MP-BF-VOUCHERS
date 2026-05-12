import { Request, Response } from 'express';
import * as catRepo  from '../repositories/categoria.repository';
import * as lojaRepo from '../repositories/loja.repository';
import * as userRepo from '../repositories/usuario.repository';

// ── Categorias ───────────────────────────────────────────────────────────────
export async function listarCategorias(req: Request, res: Response) {
  res.json(await catRepo.listar(req.query.ativas === 'true'));
}
export async function criarCategoria(req: Request, res: Response) {
  try { res.status(201).json(await catRepo.criar(req.body)); }
  catch (e: unknown) { res.status(400).json({ error: (e as Error).message }); }
}
export async function atualizarCategoria(req: Request, res: Response) {
  try { res.json(await catRepo.atualizar(Number(req.params.id), req.body)); }
  catch (e: unknown) { res.status(400).json({ error: (e as Error).message }); }
}

// ── Lojas ────────────────────────────────────────────────────────────────────
export async function listarLojas(_req: Request, res: Response) {
  res.json(await lojaRepo.listar());
}
export async function listarRegioes(_req: Request, res: Response) {
  res.json(await lojaRepo.listarRegioes());
}
export async function criarLoja(req: Request, res: Response) {
  try { res.status(201).json(await lojaRepo.criar(req.body)); }
  catch (e: unknown) { res.status(400).json({ error: (e as Error).message }); }
}
export async function atualizarLoja(req: Request, res: Response) {
  try { res.json(await lojaRepo.atualizar(Number(req.params.id), req.body)); }
  catch (e: unknown) { res.status(400).json({ error: (e as Error).message }); }
}

// ── Usuários ─────────────────────────────────────────────────────────────────
export async function listarUsuarios(_req: Request, res: Response) {
  res.json(await userRepo.listarUsuarios());
}
export async function listarPendentes(_req: Request, res: Response) {
  res.json(await userRepo.listarPendentes());
}
export async function aprovarUsuario(req: Request, res: Response) {
  try {
    await userRepo.aprovarUsuario(Number(req.params.id), req.body.loja_id, req.user!.id);
    res.json({ ok: true });
  } catch (e: unknown) { res.status(400).json({ error: (e as Error).message }); }
}
export async function inativarUsuario(req: Request, res: Response) {
  try {
    await userRepo.inativarUsuario(Number(req.params.id), req.user!.id);
    res.json({ ok: true });
  } catch (e: unknown) { res.status(400).json({ error: (e as Error).message }); }
}
