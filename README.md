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
- `docker/` Dockerfiles
- `docker-compose.yml` compose raiz para deploy (Coolify/Portainer/local)

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
NEXT_PUBLIC_API_URL=http://localhost:4000
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
