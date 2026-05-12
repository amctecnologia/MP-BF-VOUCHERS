# MP-BF-VOUCHERS — Sistema de Controle de Vouchers Bridgestone

Sistema web interno da **Minas Pneus** para controlar campanhas de vouchers de desconto da **Bridgestone**, substituindo o processo atual feito em planilhas.

**Eixo central de controle:** Campanha + Categoria + Loja.

---

## Atores

| Ator | Papel |
|---|---|
| **Administrador** | Cria campanhas, define categorias e valores, distribui vouchers por loja, valida/cancela lançamentos, gera relatórios |
| **Usuário de Vendas** | Consulta saldo disponível por categoria e registra uso de vouchers nas vendas da sua loja |

---

## Modelo de Dados

### Campanha
- `id`, `nome`, `descricao`
- `data_inicio`, `data_fim`
- `status` → RASCUNHO | ATIVA | ENCERRADA | CANCELADA
- `criado_por` (FK Usuário), `criado_em`

### Categoria (catálogo global — definido pela Bridgestone)
- `id`, `nome` (ex: "Bridgestone 15/16 - LTR"), `codigo` (ex: "BS-1516-LTR")
- `descricao`, `ativa` (boolean)

> Cadastro mestre reutilizável entre campanhas. O valor do voucher varia por campanha.

### CampanhaCategoria (categoria associada a uma campanha)
- `id`, `campanha_id` (FK), `categoria_id` (FK)
- `valor_desconto` — fixo em R$, definido pela Bridgestone para esta campanha
- `quantidade_total` — total de vouchers liberados pela Bridgestone
- `status` → ATIVA | INATIVA

> Exemplos reais de valores por campanha:
> - Bridgestone 15/16 - LTR → R$ 70,00
> - Bridgestone HRD - LTR  → R$ 120,00
> - Bridgestone 15/16 - PSR → R$ 60,00
> - Bridgestone HRD - PSR  → R$ 90,00

### Regiao ✅ (MG e Nordeste confirmados)
- `id`, `nome` (ex: "Nordeste", "Minas Gerais")

### CampanhaCategoriaRegiao (cota regional — nível intermediário)
- `id`, `campanha_categoria_id` (FK), `regiao_id` (FK)
- `quantidade_regional` — cota definida pela Bridgestone para esta região

> **Invariante:** `SUM(quantidade_regional)` = `CampanhaCategoria.quantidade_total`

### Loja
- `id`, `nome`, `codigo_loja`, `cidade`, `estado`
- `regiao_id` (FK → Regiao — obrigatório)
- `ativa` (boolean)

### CampanhaCategoriaLoja — tabela-coração do sistema
- `id`, `campanha_categoria_id` (FK), `loja_id` (FK)
- `quantidade_distribuida` — vouchers liberados para esta loja
- `saldo_disponivel` — `quantidade_distribuida` − total lançado (mantido em banco para bloqueio em tempo real)
- `atualizado_em`

> **Invariante:** `SUM(quantidade_distribuida)` das lojas de uma região ≤ `quantidade_regional` da região.
>
> **Cadastro inline:** distribuição por loja feita na mesma tela do cadastro da categoria na campanha.

### Usuário (autenticação via AD — sem senha local)
- `id`, `ad_username` (sAMAccountName), `nome`, `email`
- `perfil` → ADMIN | VENDAS
- `loja_id` (FK — obrigatório para VENDAS, nulo para ADMIN)
- `status` → PENDENTE_APROVACAO | ATIVO | INATIVO

> Primeiro login via AD cria registro com `PENDENTE_APROVACAO`. Admin associa à loja e aprova.
> Admin não precisa de cadastro local (basta pertencer ao grupo `BF-VC-ADMIN` no AD).

### VoucherUsage (Lançamento de Uso)
- `id`
- `campanha_categoria_id` (FK), `loja_id` (FK), `usuario_id` (FK)
- `nome_cliente`, `cpf_cliente` (opcional)
- `numero_nota_fiscal`, `data_venda`
- `quantidade_pneus_vendidos`, `quantidade_vouchers_aplicados`
- `valor_desconto_unitario` — **snapshot** de `CampanhaCategoria.valor_desconto` no momento do lançamento (imutável)
- `valor_desconto_total` — calculado: `quantidade_vouchers_aplicados × valor_desconto_unitario`
- `anexo_nota_fiscal` (arquivo — 10MB máx, PDF/JPG/PNG, configurável via `UPLOAD_MAX_SIZE_MB`)
- `status` → PENDENTE | VALIDADO | CANCELADO
- `observacao_admin`
- `criado_em`, `atualizado_em`, `atualizado_por`

### LogAuditoria
- `id`, `entidade`, `entidade_id`
- `acao` → CRIOU | EDITOU | CANCELOU | REDISTRIBUIU | VALIDOU
- `usuario_id` (FK), `detalhe` (JSON antes/depois), `ocorrido_em`

---

## Regras de Negócio

### Controle de Saldo
- **RN-01** — `saldo_disponivel` nunca pode ser negativo (CHECK constraint no banco).
- **RN-02** — No lançamento, verifica `saldo_disponivel ≥ quantidade_vouchers_aplicados`. Se insuficiente, bloqueia.
- **RN-03** — O débito ocorre ao criar o lançamento como PENDENTE (saldo reservado imediatamente).
- **RN-04** — Cancelamento de lançamento estorna o saldo automaticamente.
- **RN-05** — Redistribuição: redução só permitida se `redução ≤ saldo_disponivel` da loja origem.

### Preenchimento Automático (anti-erro humano)
- **RN-06** — Ao selecionar categoria no lançamento, `valor_desconto` é preenchido automaticamente. Usuário de Vendas **não pode editar** este campo.
- **RN-07** — `valor_desconto_total` calculado automaticamente, não editável.

### Visibilidade — Usuário de Vendas
- **RN-08** — Vê somente campanhas/categorias com distribuição configurada para sua loja.
- **RN-09** — Opera somente na sua loja. Sem acesso a dados de outras lojas.

### Lançamento
- **RN-10** — Campos obrigatórios: campanha, categoria, nome do cliente, nº NF, data venda, qtd pneus, qtd vouchers, anexo NF.
- **RN-11** — Bloqueado em campanha ENCERRADA ou CANCELADA.
- **RN-12** — `data_venda` deve estar dentro do período da campanha.

### Validação pelo Admin
- **RN-13** — Admin pode VALIDAR ou CANCELAR lançamentos PENDENTES.
- **RN-14** — Cancelamento de VALIDADO requer justificativa e gera auditoria.

### Campanha
- **RN-15** — Só pode ser ATIVADA com ao menos uma categoria com `quantidade_total > 0` e distribuição para ao menos uma loja.
- **RN-16** — Ao ENCERRAR, novos lançamentos bloqueados; PENDENTES permanecem para validação.

---

## Fluxos Principais

### Fluxo A — Cadastro de Campanha (Admin)
```
1. Cria cabeçalho (nome, período) → status RASCUNHO
2. Para cada categoria:
   a. Seleciona do catálogo global
   b. Informa valor_desconto (R$) e quantidade_total
   c. [INLINE] Distribui por região (Nordeste / MG)
   d. [INLINE] Distribui por loja dentro de cada região
   e. Sistema valida em tempo real: SUM(regiões) = total; SUM(lojas) ≤ regional
3. Ativa campanha → status ATIVA
```

### Fluxo B — Lançamento de Uso (Usuário de Vendas)
```
1. Acessa campanhas ativas com saldo > 0 para sua loja
2. Seleciona campanha → categoria
   → Sistema exibe: "Valor do voucher: R$ 70,00 | Saldo: 8"
3. Preenche: cliente, nº NF, data venda, qtd pneus, qtd vouchers
   → Sistema calcula: "Total de desconto: R$ 140,00"
4. Anexa nota fiscal
5. Confirma → saldo debitado, lançamento PENDENTE criado
```

### Fluxo C — Validação/Cancelamento (Admin)
```
1. Lista de lançamentos com filtros
2. Revisa dados e anexo
3. Marca VALIDADO ou CANCELADO → saldo estornado se cancelado → auditoria
```

### Fluxo D — Redistribuição de Saldo (Admin)
```
1. Painel de distribuição → seleciona campanha/categoria
2. Tabela: Loja | Distribuído | Usado | Saldo Disponível
3. Reduz loja A (validação: redução ≤ saldo_disponivel)
4. Aumenta loja B (validação: soma ≤ regional)
5. Salva → auditoria registrada
```

### Fluxo E — Aprovação de Usuário de Vendas (Admin)
```
1. Usuário de vendas faz primeiro login via AD
2. Sistema cria registro com status PENDENTE_APROVACAO
3. Admin vê lista de usuários pendentes (badge na sidebar)
4. Admin associa usuário à loja → aprova → status ATIVO
5. Usuário consegue acessar o sistema normalmente
```

---

## Funcionalidades por Perfil

### Admin
- CRUD: campanhas, catálogo de categorias, lojas, usuários
- Aprovação de novos usuários de vendas (associar à loja)
- Cadastro inline de categorias com distribuição por região e loja
- Redistribuição de saldo entre lojas
- Visualização de todos os lançamentos com filtros completos
- Validação e cancelamento de lançamentos
- Dashboard de saldo por campanha/categoria/loja
- Exportação Excel/CSV
- Log de auditoria consultável
- Badge/contador de lançamentos PENDENTES na sidebar (polling 60s)

### Usuário de Vendas
- Campanhas/categorias com saldo disponível para sua loja
- Consulta de saldo por categoria
- Registro de lançamento com upload de nota fiscal
- Histórico dos próprios lançamentos com status

---

## Relatórios

| Relatório | Filtros |
|---|---|
| Lançamentos detalhados | Campanha, categoria, loja, período, status |
| Saldo atual por loja | Campanha, categoria |
| Resumo de uso por categoria | Campanha, período |
| Auditoria de ações | Usuário, tipo de ação, período |

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| **Backend** | Node.js + TypeScript |
| **Frontend** | React + Vite + Tailwind CSS + shadcn/ui |
| **Banco** | PostgreSQL 16 Alpine |
| **Auth** | LDAP/Active Directory + JWT |
| **Proxy** | Traefik v3 externo (sem nginx próprio) |

---

## Infraestrutura de Deploy

- **Domínio:** `bf-vouchers.minaspneus.com.br`
- **Proxy:** MP-TRAEFIK centralizado (Traefik v3) — sem proxy próprio no compose
- **Rede Docker:** `traefik-public` (external)
- **Health checks:** `127.0.0.1` (não `localhost` — evita problema IPv6 em Alpine)
- **Grupos AD:** `BF-VC-ADMIN` (administrador), `BF-VC-VENDAS` (vendas)
- **Service account AD:** `svc-bf-vouchers`

---

## Variáveis de Ambiente (.env)

```env
# Banco de dados
DB_HOST=postgres
DB_PORT=5432
DB_NAME=bf_vouchers
DB_USER=bf_vouchers
DB_PASSWORD=

# JWT
JWT_SECRET=

# LDAP / Active Directory
LDAP_URL=ldap://192.168.1.10:389
LDAP_BASE_DN=DC=empresa,DC=local
LDAP_BIND_DN=CN=svc-bf-vouchers,OU=ServiceAccounts,DC=empresa,DC=local
LDAP_BIND_PASSWORD=
LDAP_SEARCH_BASE=OU=Usuarios,DC=empresa,DC=local
LDAP_GROUP_ADMIN=BF-VC-ADMIN
LDAP_GROUP_VENDAS=BF-VC-VENDAS

# Domínio
DOMAIN=bf-vouchers.minaspneus.com.br
ALLOWED_ORIGINS=https://bf-vouchers.minaspneus.com.br

# Upload
UPLOAD_MAX_SIZE_MB=10
```

---

## Identidade Visual

| Token | Cor | Uso |
|---|---|---|
| `primary` | `#2D2D2D` | Sidebar, textos principais |
| `accent` | `#A02030` | Botões, badges ativos, links |
| `background` | `#FFFFFF` | Área de conteúdo |
| `surface` | `#F5F5F5` | Cards, painéis |

Badges de status: ATIVA/VALIDADO → `#16A34A` · RASCUNHO → `#6B7280` · PENDENTE → `#D97706` · ENCERRADA → `#EA580C` · CANCELADO → `#DC2626`
