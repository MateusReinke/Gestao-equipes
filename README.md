# Gestão de Escalas Operacionais e Plantões

Plataforma SaaS API-first para gestão centralizada de escalas, turnos, plantões, férias e feriados para equipes de NOC, Service Desk, Infraestrutura e Operações.

## Stack

- **Backend:** Node.js, TypeScript, Express modular + Prisma
- **Frontend:** Next.js (App Router), React, TypeScript, TailwindCSS
- **Banco:** PostgreSQL
- **Infra:** Docker + Docker Compose

## Estrutura

- `backend/` API REST (controllers, services, repositories)
- `frontend/` painel administrativo estilo SaaS
- `prisma/` schema, migrations e seed
- `docker/` Dockerfiles e compose base

## Deploy (Coolify)

O `docker-compose.yml` da raiz já contém todos os serviços (`postgres`, `backend`, `frontend`) para evitar erro de deploy como `no service selected`.

### Importação com variáveis prontas

1. Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

2. Ajuste os valores sensíveis (`JWT_SECRET`, senha do banco, etc.).
3. No Coolify, mantenha as mesmas variáveis no painel de Environment (o projeto já possui defaults no `docker-compose.yml`).
4. Se você roda muitos projetos no mesmo host, altere as portas de host: `POSTGRES_PORT`, `BACKEND_PORT` e `FRONTEND_PORT`.

### Deploy rápido para testes (copiar e colar no Coolify)

Use exatamente estas variáveis para subir sem ajustes iniciais:

```env
POSTGRES_USER=gestao
POSTGRES_PASSWORD=gestao123
POSTGRES_DB=gestao_escalas
POSTGRES_PORT=55432

DATABASE_URL=postgresql://gestao:gestao123@postgres:5432/gestao_escalas?schema=public
APP_PORT=4000
BACKEND_PORT=54000
NODE_ENV=production
JWT_SECRET=change_me

FRONTEND_PORT=53000
API_INTERNAL_URL=http://backend:4000
NEXT_PUBLIC_API_URL=http://backend:4000
```

> Depois dos testes, troque principalmente: `POSTGRES_PASSWORD` e `JWT_SECRET`.

> Observação: para build do Next.js, mantenha `NODE_ENV=production` (Build-time e Runtime) para evitar inconsistências durante `next build`. Neste projeto, as imagens já instalam dependências de build com `npm ci --include=dev`.

### Troubleshooting (Coolify)

- Erro `failed to read /artifacts/build-time.env: Invalid template` normalmente indica valor inválido em alguma variável de ambiente.
- No campo `DATABASE_URL`, informe a URL completa (sem `${...}` incompleto), por exemplo:

```env
DATABASE_URL=postgresql://admin:SUA_SENHA@postgres:5432/gestao-bd?schema=public
```

- Evite colar variáveis com `\n` literal na mesma linha. Cada variável deve ficar em uma linha separada.

## Variáveis de ambiente

### Backend

```env
DATABASE_URL=postgresql://user:pass@host:5432/database?schema=public
APP_PORT=4000
NODE_ENV=production
JWT_SECRET=change_me
```

### Frontend

```env
# URL interna para chamadas server-side do Next dentro do Docker
API_INTERNAL_URL=http://backend:4000

# URL pública usada pelo navegador
NEXT_PUBLIC_API_URL=http://backend:4000
```

## Subir com Docker (recomendado)

```bash
docker compose up -d --build
```

No startup do backend são executados automaticamente:

1. `prisma generate`
2. `prisma migrate deploy`
3. `seed` inicial

> Você pode usar PostgreSQL externo via `DATABASE_URL` sem alterar o código.

## Seed inicial

- Equipes: `NOC`, `Infraestrutura`, `Service Desk`
- Turnos: `T1`, `T2`, `T3`, `Plantão`
- Usuário admin:
  - email: `admin@gestaoescala.local`
  - senha: `Admin@123`

## Endpoints principais

- `GET /api/plantao/agora`
- `GET /api/plantao/hoje`
- `GET /api/plantonista/agora` (compatibilidade)
- `GET /api/escala/data?data=YYYY-MM-DD`
- `GET /api/escala/colaborador/:colaboradorId`
- `GET /api/colaboradores`
- `GET /api/equipes`

## Segurança

- JWT (`POST /auth/login`)
- Perfis: `admin`, `gestor`, `visualizador`
- Auditoria de alterações em `auditoria`

## Funcionalidades entregues

- Dashboard operacional
- Cadastros base (equipes, clientes, colaboradores, turnos)
- Escala diária com regra anti-conflito e bloqueio por férias aprovadas
- Plantões por período (inclusive atravessando dias)
- Gestão de férias e feriados
- Endpoint crítico para automações (`/api/plantonista/agora`)
