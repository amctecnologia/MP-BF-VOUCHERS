# MP-BF-VOUCHERS

Sistema web interno da **Minas Pneus** para controle de campanhas de vouchers de desconto da **Bridgestone**, substituindo o processo atual feito em planilhas.

O sistema permite que o Administrador cadastre campanhas, distribua vouchers por categoria e loja, e que os Usuários de Vendas registrem o uso dos vouchers nas vendas realizadas — com controle de saldo em tempo real e auditoria completa.

---

## Arquitetura

```
                    ┌─────────────────────┐
                    │   MP-TRAEFIK (v3)   │
                    │   Reverse Proxy     │
                    └──────────┬──────────┘
                               │ bf-vouchers.minaspneus.com.br
               ┌───────────────┴───────────────┐
               │ /                             │ /api
        ┌──────▼──────┐                 ┌──────▼──────┐
        │  Frontend   │                 │   Backend   │
        │  React+Vite │                 │  Node.js TS │──► PostgreSQL
        │    :80      │                 │    :3000    │
        └─────────────┘                 └─────────────┘
```

| Container    | Imagem               | Função                                  |
|--------------|----------------------|-----------------------------------------|
| `frontend`   | build ./frontend     | React + Vite + Tailwind CSS + shadcn/ui |
| `backend`    | build ./backend      | API REST, LDAP/AD, regras de saldo      |
| `postgres`   | postgres:16-alpine   | Banco de dados                          |

> **Proxy:** Traefik centralizado (MP-TRAEFIK). Este projeto não tem proxy próprio.

---

## Pré-requisitos

- Docker >= 24.x e Docker Compose >= 2.x
- Stack **mp-traefik** rodando no Portainer com a rede `traefik-public` criada
- Registro DNS tipo A para `bf-vouchers.minaspneus.com.br` apontando para o servidor
- Acesso ao servidor LDAP/Active Directory
- Grupos `BF-VC-ADMIN` e `BF-VC-VENDAS` criados no AD (ver seção abaixo)

---

## Configuração do Active Directory

### 1. Criar os grupos de segurança

```powershell
New-ADGroup -Name "BF-VC-ADMIN"  -GroupScope Global -GroupCategory Security
New-ADGroup -Name "BF-VC-VENDAS" -GroupScope Global -GroupCategory Security
```

### 2. Criar o service account

```powershell
New-ADUser -Name "svc-bf-vouchers" `
  -SamAccountName "svc-bf-vouchers" `
  -AccountPassword (ConvertTo-SecureString "SenhaSegura!" -AsPlainText -Force) `
  -PasswordNeverExpires $true `
  -Enabled $true

# Conceder permissão de leitura na OU de usuários
# (via ADSI Edit ou Delegate Control na OU de usuários)
```

### 3. Adicionar usuários aos grupos

```powershell
# Administradores do sistema
Add-ADGroupMember -Identity "BF-VC-ADMIN"  -Members "joao.silva"

# Usuários de vendas (também podem ser adicionados pelo sistema no primeiro login)
Add-ADGroupMember -Identity "BF-VC-VENDAS" -Members "maria.vendas"
```

### Permissões por grupo

| Grupo          | Campanhas | Distribuição | Lançamentos | Relatórios | Usuários |
|----------------|:---------:|:------------:|:-----------:|:----------:|:--------:|
| `BF-VC-ADMIN`  | ✅ CRUD   | ✅           | ✅ Validar  | ✅         | ✅       |
| `BF-VC-VENDAS` | ✅ Ver    | ❌           | ✅ Criar    | ❌         | ❌       |
| Outros         | ❌        | ❌           | ❌          | ❌         | ❌       |

---

## Configuração do `.env`

```bash
cp .env.example .env
nano .env
```

### Banco de dados

```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=bf_vouchers
DB_USER=bf_vouchers
DB_PASSWORD=senha_segura_aqui
```

### JWT

```env
# Gere com: openssl rand -base64 64
JWT_SECRET=chave_muito_longa_e_aleatoria
```

### LDAP / Active Directory

```env
LDAP_URL=ldap://192.168.1.10:389          # IP ou hostname do AD
LDAP_BASE_DN=DC=empresa,DC=local          # Base DN do domínio

# Service account
LDAP_BIND_DN=CN=svc-bf-vouchers,OU=ServiceAccounts,DC=empresa,DC=local
LDAP_BIND_PASSWORD=senha_do_service_account

# OU onde os usuários estão
LDAP_SEARCH_BASE=OU=Usuarios,DC=empresa,DC=local

# Grupos de acesso
LDAP_GROUP_ADMIN=BF-VC-ADMIN
LDAP_GROUP_VENDAS=BF-VC-VENDAS
```

> **LDAPS (recomendado):** Troque `ldap://` por `ldaps://` e use a porta 636.

### Domínio e CORS

```env
DOMAIN=bf-vouchers.minaspneus.com.br
ALLOWED_ORIGINS=https://bf-vouchers.minaspneus.com.br
```

### Upload de nota fiscal

```env
UPLOAD_MAX_SIZE_MB=10    # Tamanho máximo por arquivo (PDF, JPG, PNG)
```

---

## Deploy no Portainer (Stack)

### Checklist antes de subir

- [ ] Registro DNS tipo A criado para `bf-vouchers.minaspneus.com.br`
- [ ] Stack `mp-traefik` rodando no Portainer
- [ ] Rede `traefik-public` existe (`docker network ls | grep traefik-public`)
- [ ] Grupos `BF-VC-ADMIN` e `BF-VC-VENDAS` criados no AD
- [ ] Service account `svc-bf-vouchers` com permissão de leitura criado
- [ ] Arquivo `.env` preenchido com todos os valores

### Passo a passo

1. No Portainer, acesse **Stacks → Add Stack**
2. Dê o nome `mp-bf-vouchers`
3. Selecione **Upload** e envie o `docker-compose.yml`
4. Em **Environment variables**, adicione todas as variáveis do `.env`
5. Clique em **Deploy the stack**
6. Aguarde todos os containers ficarem `healthy` (verificar em **Containers**)
7. Acesse `https://bf-vouchers.minaspneus.com.br` — deverá exibir a tela de login

---

## Primeiro Acesso

### Administrador

1. Faça login com sua conta AD (que pertence ao grupo `BF-VC-ADMIN`)
2. O sistema reconhece automaticamente o perfil de administrador
3. Configure as lojas, regiões e o catálogo de categorias antes de criar campanhas

### Usuário de Vendas

1. Faça login com sua conta AD (que pertence ao grupo `BF-VC-VENDAS`)
2. Na primeira vez, o sistema cria um registro com status **Aguardando Aprovação**
3. Você verá a tela: *"Acesso em análise. Aguarde a liberação pelo administrador."*
4. O Administrador associa sua conta à loja correspondente e aprova o acesso
5. No próximo login, você terá acesso completo ao seu painel de vendas

---

## Estrutura do Projeto

```
MP-BF-VOUCHERS/
├── .env.example              ← Modelo de configuração
├── .gitignore
├── docker-compose.yml
├── README.md
├── CLAUDE.md                 ← Documentação de regras de negócio (para Claude Code)
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app.ts
│       ├── server.ts
│       ├── config/
│       │   ├── database.ts   ← Conexão PostgreSQL
│       │   └── ldap.ts       ← Configuração LDAP/AD
│       ├── controllers/      ← Handlers de rota
│       │   ├── auth.controller.ts
│       │   ├── campanha.controller.ts
│       │   ├── categoria.controller.ts
│       │   ├── lancamento.controller.ts
│       │   ├── distribuicao.controller.ts
│       │   └── relatorio.controller.ts
│       ├── middleware/
│       │   ├── authenticate.ts   ← Valida JWT
│       │   └── authorize.ts      ← Verifica perfil (ADMIN|VENDAS)
│       ├── repositories/         ← Queries SQL
│       ├── routes/               ← Definição de rotas
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── saldo.service.ts  ← Débito/estorno com transações
│       │   └── relatorio.service.ts
│       └── types/
├── frontend/
│   ├── Dockerfile
│   └── src/
│       ├── components/
│       │   ├── Layout/           ← Sidebar + Header
│       │   ├── CampanhaForm/     ← Form inline com distribuição
│       │   └── LancamentoForm/
│       ├── contexts/
│       │   └── AuthContext.tsx
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── admin/            ← Telas do administrador
│       │   └── vendas/           ← Telas do usuário de vendas
│       ├── services/
│       │   └── api.ts            ← Cliente Axios
│       └── types/
└── database/
    └── init/
        ├── 001_schema.sql        ← Criação de tabelas
        └── 002_seed.sql          ← Dados iniciais (regiões, lojas, categorias)
```

---

## Comandos Úteis

```bash
# Subir todos os serviços
docker compose up -d

# Ver logs em tempo real
docker compose logs -f

# Logs de um serviço específico
docker compose logs -f backend
docker compose logs -f frontend

# Verificar status e healthcheck
docker compose ps

# Reiniciar um serviço
docker compose restart backend

# Acessar o banco de dados
docker compose exec postgres psql -U bf_vouchers -d bf_vouchers

# Parar tudo (preserva dados)
docker compose down

# Parar e remover volumes — CUIDADO: apaga todos os dados
docker compose down -v
```

---

## Suporte

Em caso de problemas, verifique:

1. `docker compose logs backend` — erros de conexão LDAP ou banco
2. `docker compose ps` — containers unhealthy (Traefik ignora containers não saudáveis)
3. Dashboard do Traefik — verificar se os routers `mp-bf-vouchers-frontend` e `mp-bf-vouchers-backend` aparecem
4. Variáveis do `.env` preenchidas corretamente (especialmente `LDAP_BIND_PASSWORD` e `JWT_SECRET`)
5. Grupos `BF-VC-ADMIN` e `BF-VC-VENDAS` existem no AD e o service account tem permissão de leitura
