# MP-SIMULADOR-VENDAS

Sistema web para simulação de condições de pagamento de vendas da **Minas Pneus — Oficina Automotiva**.

Autenticação via Active Directory (LDAP), controle de acesso por grupos e interface moderna em dashboard.

---

## Arquitetura

```
┌─────────┐  80/443   ┌──────────┐         ┌──────────┐
│  Nginx  │──────────►│ Frontend │         │ Backend  │
│  Proxy  │           │  React   │         │ Node.js  │──► PostgreSQL
│(SSL/TLS)│──/api/───►│  :80     │         │  :3000   │
└─────────┘           └──────────┘         └──────────┘
```

| Container  | Imagem             | Função                              |
|------------|--------------------|-------------------------------------|
| `proxy`    | nginx:alpine       | Proxy reverso, SSL Let's Encrypt    |
| `frontend` | build ./frontend   | React + Vite + Tailwind CSS         |
| `backend`  | build ./backend    | API REST, LDAP, regras de cálculo   |
| `postgres` | postgres:16-alpine | Banco de dados                      |

---

## Pré-requisitos

- Docker >= 24.x
- Docker Compose >= 2.x
- Domínio apontando para o servidor (necessário para SSL)
- Acesso ao servidor LDAP/AD

---

## Setup Rápido

### 1. Clonar / copiar o projeto

```bash
git clone <repositorio> MP-SIMULADORVENDAS
cd MP-SIMULADORVENDAS
```

### 2. Configurar o `.env`

```bash
cp .env.example .env
nano .env   # ou vim .env
```

Preencha **todos** os campos — especialmente LDAP e domínio. Veja detalhes abaixo.

### 3. Primeiro deploy (HTTP apenas — para gerar o certificado SSL)

**Passo 3.1** — Usar o config HTTP simples temporariamente:

```bash
cp proxy/conf.d/default.conf.http-only proxy/conf.d/active.conf
```

No `docker-compose.yml`, altere temporariamente o volume do proxy:
```yaml
- ./proxy/conf.d/active.conf:/etc/nginx/conf.d/default.conf:ro
```

**Passo 3.2** — Subir os containers:

```bash
docker compose up -d
```

**Passo 3.3** — Gerar o certificado SSL com Certbot:

```bash
docker run --rm \
  -v ./proxy/certbot/www:/var/www/certbot \
  -v ./proxy/certbot/conf:/etc/letsencrypt \
  certbot/certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email seu@email.com \
  --agree-tos --no-eff-email \
  -d seu-dominio.com
```

**Passo 3.4** — Reverter para config HTTPS (template) no `docker-compose.yml`:
```yaml
- ./proxy/conf.d/default.conf.template:/etc/nginx/templates/default.conf.template:ro
```

**Passo 3.5** — Recriar o proxy:
```bash
docker compose up -d --force-recreate proxy
```

### 4. Verificar status

```bash
docker compose ps
docker compose logs -f backend
```

Acesse `https://seu-dominio.com` — deverá exibir a tela de login com a logo da Minas Pneus.

---

## Configuração do `.env`

### Banco de dados

```env
DB_HOST=postgres       # nome do serviço no docker-compose
DB_PORT=5432
DB_NAME=simulador_vendas
DB_USER=simulador
DB_PASSWORD=senha_segura_aqui
```

### JWT

```env
# Gere com: openssl rand -base64 64
JWT_SECRET=chave_muito_longa_e_aleatoria
```

### LDAP / Active Directory

```env
LDAP_URL=ldap://192.168.1.10:389        # IP ou hostname do AD
LDAP_BASE_DN=DC=empresa,DC=local        # Base DN do domínio

# Service account (usuário de serviço com permissão de leitura)
LDAP_BIND_DN=CN=svc-simulador,OU=ServiceAccounts,DC=empresa,DC=local
LDAP_BIND_PASSWORD=senha_do_service_account

# OU onde os usuários estão
LDAP_SEARCH_BASE=OU=Usuarios,DC=empresa,DC=local

# Grupos de acesso (parte do nome ou CN completo)
LDAP_GROUP_VENDAS=SV-VENDAS
LDAP_GROUP_MANAGER=SV-MANAGER
```

> **LDAPS (seguro):** Troque `ldap://` por `ldaps://` e use a porta 636.

### Domínio e CORS

```env
DOMAIN=simulador.minaspneus.com.br
ALLOWED_ORIGINS=https://simulador.minaspneus.com.br
```

---

## Configuração do Active Directory

### Grupos necessários

Crie os seguintes grupos de segurança no AD:

| Grupo        | Acesso                                  |
|--------------|-----------------------------------------|
| `SV-VENDAS`  | Simulador de vendas (somente leitura)   |
| `SV-MANAGER` | Simulador + Área administrativa         |

### Service Account

Crie um usuário de serviço (ex: `svc-simulador`) com:
- Permissão de leitura na OU de usuários
- Senha que não expira (`-PasswordNeverExpires`)

```powershell
# PowerShell no AD
New-ADUser -Name "svc-simulador" -SamAccountName "svc-simulador" `
  -AccountPassword (ConvertTo-SecureString "Senha123!" -AsPlainText -Force) `
  -PasswordNeverExpires $true -Enabled $true
```

### Adicionar usuários aos grupos

```powershell
Add-ADGroupMember -Identity "SV-VENDAS" -Members "joao.silva"
Add-ADGroupMember -Identity "SV-MANAGER" -Members "maria.gerente"
```

---

## Deploy no Portainer (Stack)

1. No Portainer, acesse **Stacks → Add Stack**
2. Selecione **Upload** e envie o `docker-compose.yml`
3. Em **Environment variables**, adicione todas as variáveis do `.env`
4. Certifique-se que os volumes e arquivos de configuração do proxy estão presentes no servidor
5. Clique em **Deploy the stack**

> **Atenção:** Os arquivos `database/init/`, `proxy/conf.d/` e `proxy/certbot/` precisam existir no servidor antes do deploy.

---

## Renovação automática do SSL

Configure um cron job no servidor para renovar o certificado automaticamente:

```bash
# crontab -e
0 3 * * * docker run --rm \
  -v /caminho/para/proxy/certbot/www:/var/www/certbot \
  -v /caminho/para/proxy/certbot/conf:/etc/letsencrypt \
  certbot/certbot renew --quiet && \
  docker compose -f /caminho/para/docker-compose.yml exec proxy nginx -s reload
```

---

## Comandos úteis

```bash
# Subir todos os serviços
docker compose up -d

# Ver logs em tempo real
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f backend

# Reiniciar um serviço
docker compose restart backend

# Parar tudo
docker compose down

# Parar e remover volumes (CUIDADO: apaga os dados)
docker compose down -v

# Ver status e healthcheck
docker compose ps

# Acessar o banco de dados
docker compose exec postgres psql -U simulador -d simulador_vendas
```

---

## Grupos e Permissões

| Grupo        | Simulador | Admin (fatores) | Auditoria |
|--------------|:---------:|:---------------:|:---------:|
| `SV-VENDAS`  | ✅        | ❌              | ❌        |
| `SV-MANAGER` | ✅        | ✅              | ✅        |
| Outros       | ❌        | ❌              | ❌        |

---

## Categorias de produtos e Lógica de Cálculo

### Pneus (categorias 1–6)

O simulador aplica um **fator à vista** parametrizável por categoria, seguido de uma cascata de multiplicadores fixos:

| Condição | Multiplicador |
|----------|--------------|
| À Vista  | `custo × fator_categoria` (arredondado para baixo) |
| 1x       | À Vista × 1,035 |
| 2x – 6x  | parcela anterior × 1,01 |
| 7x – 12x | parcela anterior × 1,015 |

Fatores à vista padrão (editáveis na Área Administrativa):

| Categoria | Fator padrão |
|-----------|:------------:|
| Pirelli, Goodyear, Dunlop, Michelin, Continental e demais pneus nacionais | 1,15 |
| Bridgestone, Firestone PSR \| LTR | 1,25 |
| Importados diversos Aro 14 | 1,25 |
| Importados diversos Aro 15 | 1,25 |
| Importados diversos Aro 16 | 1,30 |
| Importados diversos Aro 17 e acima | 1,35 |

### Peças (categoria 7)

A margem é calculada automaticamente por faixa de custo (sem parametrização):

| Custo de aquisição | Margem aplicada |
|--------------------|:--------------:|
| Até R$ 10          | 150% |
| Até R$ 15          | 100% |
| Até R$ 20          | 80%  |
| Até R$ 30          | 70%  |
| Até R$ 50          | 65%  |
| Até R$ 100         | 60%  |
| Até R$ 200         | 55%  |
| Até R$ 300         | 45%  |
| Até R$ 500         | 40%  |
| Até R$ 1.000       | 35%  |
| Acima de R$ 1.000  | 30%  |

As parcelas de peças seguem a mesma cascata de pneus, com arredondamento padrão (ARRED).

> Os fatores de pneus são carregados automaticamente no primeiro start e editáveis na **Área Administrativa**.

---

## Estrutura do projeto

```
MP-SIMULADORVENDAS/
├── .env.example         ← Modelo de configuração
├── .gitignore
├── docker-compose.yml
├── README.md
├── backend/             ← API Node.js + TypeScript
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app.ts
│       ├── server.ts
│       ├── config/      ← database.ts, ldap.ts
│       ├── controllers/ ← auth, simulator, admin
│       ├── middleware/  ← authenticate, authorize
│       ├── repositories/
│       ├── routes/
│       ├── services/
│       └── utils/
├── frontend/            ← React + Vite + Tailwind
│   ├── Dockerfile
│   └── src/
│       ├── components/  ← Layout, Simulator, Admin
│       ├── contexts/    ← AuthContext
│       ├── pages/       ← Login, Simulator, Admin
│       ├── services/    ← api.ts (Axios)
│       └── types/
├── database/
│   └── init/
│       ├── 001_schema.sql
│       └── 002_seed.sql
└── proxy/
    └── conf.d/
        ├── default.conf.template   ← HTTPS (produção)
        └── default.conf.http-only  ← HTTP (setup inicial SSL)
```

---

## Suporte

Em caso de dúvidas ou problemas, verifique:

1. `docker compose logs backend` — erros de conexão LDAP ou banco
2. `docker compose logs proxy` — erros de SSL ou roteamento
3. Variáveis do `.env` preenchidas corretamente
4. Grupos `SV-VENDAS` e `SV-MANAGER` criados no AD
5. Service account com permissão de leitura na OU de usuários
