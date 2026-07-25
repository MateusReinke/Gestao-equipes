# Sistema de Gestão Operacional

Sistema full-stack pronto para produção para gestão de clientes, equipes, colaboradores, gestores, escalas, plantões e férias.

## Stack

- Frontend: Next.js 15 + React + TypeScript + Tailwind
- Backend: Node.js + Express + TypeScript + JWT
- Banco: PostgreSQL 16
- ORM: Prisma
- Deploy: Docker Compose

## Subida em produção

1. Copie `.env.example` para `.env` e defina um `JWT_SECRET` forte (ex.: `openssl rand -hex 32`). O backend recusa subir sem essa variável.
2. Suba os containers:

```bash
docker-compose up -d --build
```

Após a subida:

- Frontend: `http://localhost:4333` — abre em `/login`
- Backend: `http://localhost:54000`
- Healthcheck: `http://localhost:54000/health`

Em uma base **vazia**, defina `SEED_ON_BOOT=true` no `.env` (ou rode `docker compose exec backend npm run seed`) para criar o admin inicial e os dados de demonstração:

- Admin padrão: `admin@gestao.local` / `Admin@123`
- Gestor de teste: `gestor@gestao.local` / `Gestor@123`

Troque essas senhas assim que possível — são apenas o bootstrap inicial.

## O que acontece automaticamente no deploy

O container do backend executa automaticamente:

1. `prisma generate`
2. `prisma migrate deploy`
3. seed **opcional** (só roda se `SEED_ON_BOOT=true`) — e é idempotente: só cria dados se o admin padrão ainda não existir. Nunca apaga dados existentes.
4. inicialização da API

Sem necessidade de:

- criar banco manualmente
- rodar SQL manual
- configurar usuário inicial após o deploy

Para resetar o dataset de demonstração em desenvolvimento local (apaga tudo e recria), use `npm run seed:dev:reset` dentro de `backend/` — esse script se recusa a rodar com `NODE_ENV=production`.

## Login

O painel exige autenticação de verdade: acesse `/login`, informe e-mail e senha. A sessão fica em um cookie `httpOnly` de curta duração (12h, alinhado à expiração do JWT); não há mais nenhum login automático com credenciais fixas de ambiente.

## Serviços Docker

O `docker-compose.yml` publica três serviços obrigatórios:

- `postgres`
- `backend`
- `frontend`

## Endpoints obrigatórios entregues

- `GET /plantao/atual`
- `GET /clientes/:id/responsavel`
- `GET /clientes/:id/plantonista`

## Módulos do frontend

- Dashboard
- Clientes
- Equipes
- Colaboradores
- Gestores
- Escalas
- Plantões
- Férias

## Regras operacionais implementadas

- autenticação JWT com perfis `admin` e `gestor`
- gestor visualiza apenas equipes sob sua gestão
- múltiplos plantonistas simultâneos
- identificação de plantonistas atuais e próximos
- colaborador em férias aprovadas não aparece como plantonista atual
- escalas 12x36, 5x2 e personalizadas

## Estrutura do repositório

- `backend/`: API REST e autenticação — `controllers/` (HTTP) → `services/` (regra de negócio) → `repositories/` (acesso a dados via Prisma)
- `frontend/`: painel web corporativo — `/login` público, demais rotas protegidas pelo grupo `(app)` e por `middleware.ts`
- `prisma/`: schema, migrations, `seed.ts` (idempotente, produção) e `seed.dev.ts` (destrutivo, só para desenvolvimento local)
- `docker/`: Dockerfiles e compose espelhado

## Testes

```bash
cd backend && npm test
```

Cobre login (credenciais válidas/inválidas/usuário inativo), o middleware de autenticação (token ausente/inválido, role sem permissão) e a resolução de escopo por equipe (admin vê tudo, gestor só as equipes vinculadas).
