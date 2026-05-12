-- ─────────────────────────────────────────────────────────────────────────────
-- MP-BF-VOUCHERS — Seed inicial
-- ─────────────────────────────────────────────────────────────────────────────

-- Regiões
INSERT INTO regioes (nome) VALUES
  ('Minas Gerais'),
  ('Nordeste');

-- Lojas de exemplo
INSERT INTO lojas (nome, codigo_loja, cidade, estado, regiao_id) VALUES
  ('Minas Pneus BH Centro',    'MP-BH-001', 'Belo Horizonte', 'MG', 1),
  ('Minas Pneus Contagem',     'MP-CT-001', 'Contagem',       'MG', 1),
  ('Minas Pneus Betim',        'MP-BT-001', 'Betim',          'MG', 1),
  ('Minas Pneus Uberlândia',   'MP-UB-001', 'Uberlândia',     'MG', 1),
  ('Minas Pneus Recife',       'MP-RC-001', 'Recife',         'PE', 2),
  ('Minas Pneus Salvador',     'MP-SV-001', 'Salvador',       'BA', 2),
  ('Minas Pneus Fortaleza',    'MP-FT-001', 'Fortaleza',      'CE', 2);

-- Catálogo de categorias Bridgestone
INSERT INTO categorias (nome, codigo, descricao) VALUES
  ('Bridgestone 15/16 - LTR', 'BS-1516-LTR', 'Pneus Bridgestone aro 15/16 linha LTR'),
  ('Bridgestone HRD - LTR',   'BS-HRD-LTR',  'Pneus Bridgestone HRD linha LTR'),
  ('Bridgestone 15/16 - PSR', 'BS-1516-PSR', 'Pneus Bridgestone aro 15/16 linha PSR'),
  ('Bridgestone HRD - PSR',   'BS-HRD-PSR',  'Pneus Bridgestone HRD linha PSR');
