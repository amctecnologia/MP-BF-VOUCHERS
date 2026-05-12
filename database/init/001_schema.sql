-- ─────────────────────────────────────────────────────────────────────────────
-- MP-BF-VOUCHERS — Schema
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Regiões ──────────────────────────────────────────────────────────────────
CREATE TABLE regioes (
  id   SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE
);

-- ── Lojas ────────────────────────────────────────────────────────────────────
CREATE TABLE lojas (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(150) NOT NULL,
  codigo_loja VARCHAR(20)  NOT NULL UNIQUE,
  regiao_id   INTEGER      NOT NULL REFERENCES regioes(id),
  ativa       BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ── Usuários (sem senha — autenticação via AD) ────────────────────────────────
CREATE TYPE perfil_usuario  AS ENUM ('ADMIN', 'VENDAS');
CREATE TYPE status_usuario  AS ENUM ('PENDENTE_APROVACAO', 'ATIVO', 'INATIVO');

CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  ad_username VARCHAR(100) NOT NULL UNIQUE,
  nome        VARCHAR(150) NOT NULL,
  email       VARCHAR(200),
  perfil      perfil_usuario NOT NULL,
  loja_id     INTEGER REFERENCES lojas(id),
  status      status_usuario NOT NULL DEFAULT 'PENDENTE_APROVACAO',
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_vendas_loja CHECK (
    perfil = 'ADMIN' OR loja_id IS NOT NULL
  )
);

-- ── Categorias (catálogo global Bridgestone) ──────────────────────────────────
CREATE TABLE categorias (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(150) NOT NULL,
  codigo    VARCHAR(50)  NOT NULL UNIQUE,
  descricao TEXT,
  ativa     BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── Campanhas ────────────────────────────────────────────────────────────────
CREATE TYPE status_campanha AS ENUM ('RASCUNHO', 'ATIVA', 'ENCERRADA', 'CANCELADA');

CREATE TABLE campanhas (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(200) NOT NULL,
  descricao   TEXT,
  data_inicio DATE         NOT NULL,
  data_fim    DATE         NOT NULL,
  status      status_campanha NOT NULL DEFAULT 'RASCUNHO',
  criado_por  INTEGER      REFERENCES users(id),
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_periodo CHECK (data_fim >= data_inicio)
);

-- ── CampanhaCategoria ─────────────────────────────────────────────────────────
CREATE TYPE status_campanha_categoria AS ENUM ('ATIVA', 'INATIVA');

CREATE TABLE campanha_categorias (
  id               SERIAL PRIMARY KEY,
  campanha_id      INTEGER        NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  categoria_id     INTEGER        NOT NULL REFERENCES categorias(id),
  valor_desconto   NUMERIC(10,2)  NOT NULL CHECK (valor_desconto > 0),
  quantidade_total INTEGER        NOT NULL CHECK (quantidade_total > 0),
  status           status_campanha_categoria NOT NULL DEFAULT 'ATIVA',
  UNIQUE (campanha_id, categoria_id)
);

-- ── CampanhaCategoriaRegiao (cota por região) ─────────────────────────────────
CREATE TABLE campanha_categoria_regioes (
  id                    SERIAL PRIMARY KEY,
  campanha_categoria_id INTEGER NOT NULL REFERENCES campanha_categorias(id) ON DELETE CASCADE,
  regiao_id             INTEGER NOT NULL REFERENCES regioes(id),
  quantidade_regional   INTEGER NOT NULL CHECK (quantidade_regional >= 0),
  UNIQUE (campanha_categoria_id, regiao_id)
);

-- ── CampanhaCategoriaLoja (tabela-coração) ────────────────────────────────────
CREATE TABLE campanha_categoria_lojas (
  id                    SERIAL PRIMARY KEY,
  campanha_categoria_id INTEGER NOT NULL REFERENCES campanha_categorias(id) ON DELETE CASCADE,
  loja_id               INTEGER NOT NULL REFERENCES lojas(id),
  quantidade_distribuida INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_distribuida >= 0),
  saldo_disponivel      INTEGER NOT NULL DEFAULT 0,
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campanha_categoria_id, loja_id),
  CONSTRAINT chk_saldo_nao_negativo CHECK (saldo_disponivel >= 0),
  CONSTRAINT chk_saldo_consistente  CHECK (saldo_disponivel <= quantidade_distribuida)
);

-- ── VoucherUsage (Lançamentos de Uso) ────────────────────────────────────────
CREATE TYPE status_lancamento AS ENUM ('PENDENTE', 'VALIDADO', 'CANCELADO');

CREATE TABLE voucher_usages (
  id                        SERIAL PRIMARY KEY,
  campanha_categoria_id     INTEGER        NOT NULL REFERENCES campanha_categorias(id),
  loja_id                   INTEGER        NOT NULL REFERENCES lojas(id),
  usuario_id                INTEGER        NOT NULL REFERENCES users(id),
  nome_cliente              VARCHAR(200)   NOT NULL,
  cpf_cliente               VARCHAR(14),
  numero_nota_fiscal        VARCHAR(50)    NOT NULL,
  data_venda                DATE           NOT NULL,
  quantidade_pneus_vendidos INTEGER        NOT NULL CHECK (quantidade_pneus_vendidos > 0),
  quantidade_vouchers_aplicados INTEGER    NOT NULL CHECK (quantidade_vouchers_aplicados > 0),
  valor_desconto_unitario   NUMERIC(10,2)  NOT NULL,
  valor_desconto_total      NUMERIC(10,2)  NOT NULL,
  anexo_nota_fiscal         VARCHAR(500),
  status                    status_lancamento NOT NULL DEFAULT 'PENDENTE',
  observacao_admin          TEXT,
  criado_em                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por            INTEGER REFERENCES users(id),
  CONSTRAINT chk_valor_total CHECK (
    valor_desconto_total = quantidade_vouchers_aplicados * valor_desconto_unitario
  )
);

-- ── Log de Auditoria ─────────────────────────────────────────────────────────
CREATE TYPE acao_auditoria AS ENUM ('CRIOU', 'EDITOU', 'CANCELOU', 'REDISTRIBUIU', 'VALIDOU', 'APROVOU', 'ATIVOU', 'ENCERROU');

CREATE TABLE log_auditoria (
  id          SERIAL PRIMARY KEY,
  entidade    VARCHAR(100) NOT NULL,
  entidade_id INTEGER      NOT NULL,
  acao        acao_auditoria NOT NULL,
  usuario_id  INTEGER      REFERENCES users(id),
  detalhe     JSONB,
  ocorrido_em TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Índices de performance ────────────────────────────────────────────────────
CREATE INDEX idx_ccl_campanha_categoria ON campanha_categoria_lojas(campanha_categoria_id);
CREATE INDEX idx_ccl_loja               ON campanha_categoria_lojas(loja_id);
CREATE INDEX idx_vu_campanha_categoria  ON voucher_usages(campanha_categoria_id);
CREATE INDEX idx_vu_loja                ON voucher_usages(loja_id);
CREATE INDEX idx_vu_usuario             ON voucher_usages(usuario_id);
CREATE INDEX idx_vu_status              ON voucher_usages(status);
CREATE INDEX idx_log_entidade           ON log_auditoria(entidade, entidade_id);
CREATE INDEX idx_log_usuario            ON log_auditoria(usuario_id);
CREATE INDEX idx_users_ad_username      ON users(ad_username);
CREATE INDEX idx_campanhas_status       ON campanhas(status);
