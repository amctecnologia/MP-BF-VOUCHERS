import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { loginHandler } from '../controllers/auth.controller';
import * as campanha from '../controllers/campanha.controller';
import * as lancamento from '../controllers/lancamento.controller';
import * as distribuicao from '../controllers/distribuicao.controller';
import * as misc from '../controllers/misc.controller';
import * as relatorio from '../controllers/relatorio.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

const maxSizeMB = Number(process.env.UPLOAD_MAX_SIZE_MB || 10);
const storage = multer.diskStorage({
  destination: path.join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: maxSizeMB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// ── Health ────────────────────────────────────────────────────────────────────
router.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

// ── Auth ─────────────────────────────────────────────────────────────────────
router.post('/auth/login', loginHandler);

// ── Uploads — público (browser abre link direto sem header Authorization) ─────
router.get('/uploads/:filename', (req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'uploads', req.params.filename));
});

// ── Acesso autenticado ────────────────────────────────────────────────────────
router.use(authenticate);

// ── Regiões e Lojas ───────────────────────────────────────────────────────────
router.get('/regioes', misc.listarRegioes);
router.get('/lojas', misc.listarLojas);
router.post('/lojas', authorize('ADMIN'), misc.criarLoja);
router.put('/lojas/:id', authorize('ADMIN'), misc.atualizarLoja);
router.delete('/lojas/:id', authorize('ADMIN'), misc.removerLoja);

// ── Categorias ────────────────────────────────────────────────────────────────
router.get('/categorias', misc.listarCategorias);
router.post('/categorias', authorize('ADMIN'), misc.criarCategoria);
router.put('/categorias/:id', authorize('ADMIN'), misc.atualizarCategoria);

// ── Usuários ──────────────────────────────────────────────────────────────────
router.get('/usuarios', authorize('ADMIN'), misc.listarUsuarios);
router.get('/usuarios/pendentes', authorize('ADMIN'), misc.listarPendentes);
router.post('/usuarios/:id/aprovar', authorize('ADMIN'), misc.aprovarUsuario);
router.post('/usuarios/:id/inativar', authorize('ADMIN'), misc.inativarUsuario);

// ── Campanhas ─────────────────────────────────────────────────────────────────
router.get('/campanhas', campanha.listar);
router.get('/campanhas/:id', campanha.buscar);
router.post('/campanhas', authorize('ADMIN'), campanha.criar);
router.patch('/campanhas/:id/status', authorize('ADMIN'), campanha.atualizarStatus);
router.post('/campanhas/:id/categorias', authorize('ADMIN'), campanha.salvarCategoria);
router.get('/campanhas/saldo/loja', campanha.saldoPorLoja);

// ── Lançamentos ───────────────────────────────────────────────────────────────
router.get('/lancamentos', lancamento.listar);
router.get('/lancamentos/pendentes/count', authorize('ADMIN'), lancamento.contarPendentes);
router.post('/lancamentos', authorize('VENDAS'), upload.single('anexo_nota_fiscal'), lancamento.criar);
router.patch('/lancamentos/:id/validar', authorize('ADMIN'), lancamento.validar);
router.patch('/lancamentos/:id/cancelar', authorize('ADMIN'), lancamento.cancelar);

// ── Distribuição ──────────────────────────────────────────────────────────────
router.post('/distribuicao/redistribuir', authorize('ADMIN'), distribuicao.redistribuirSaldo);

// ── Relatórios ────────────────────────────────────────────────────────────────
router.get('/relatorios/lancamentos/export', authorize('ADMIN'), relatorio.exportarLancamentos);
router.get('/relatorios/saldo-por-categoria', authorize('ADMIN'), relatorio.saldoPorCategoria);

export default router;
