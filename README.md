# Sistema de Gestão Operacional

Sistema full-stack **multi-tenant** para gestão de clientes, equipes, colaboradores, gestores, escalas, plantões e férias. Cada empresa (tenant) tem seus próprios dados, totalmente isolados dos demais.

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

Em uma base **vazia**, defina `SEED_ON_BOOT=true` no `.env` (ou rode `docker compose exec backend npm run seed`) para criar o tenant "Empresa Padrão", o Administrador Global e os dados de demonstração:

- Administrador Global: `admin@gestao.local` / `Admin@123` (também é membro da Empresa Padrão como admin, então continua vendo a operação normalmente)
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

## Login e multi-tenancy

O painel exige autenticação de verdade: acesse `/login`, informe e-mail e senha. A sessão fica em um cookie `httpOnly` de curta duração (12h, alinhado à expiração do JWT).

Um usuário é uma **identidade global** (e-mail único na plataforma) que pode ter vínculo — e papel — em mais de uma empresa (tenant):

- **1 vínculo**: login entra direto nessa empresa.
- **2+ vínculos**: o login mostra uma tela de seleção de empresa antes de emitir a sessão. A sessão fica presa a essa empresa até o próximo login (sem troca dentro do app para esse usuário).
- **Administrador Global** (`isGlobalAdmin`): não depende de vínculo. Entra direto no **console da plataforma** (`/console`), onde vê todas as empresas cadastradas, pode criar novas e "entrar" em qualquer uma delas. Uma vez dentro de uma empresa, um seletor no cabeçalho permite trocar para outra ou voltar ao console — sem precisar deslogar. Nenhum outro papel tem esse seletor.

Isolamento: toda tabela de domínio (clientes, equipes, colaboradores, escalas, plantões, férias etc.) tem uma coluna `tenant_id`, e cada repositório do backend recebe o tenant explicitamente — nenhuma consulta lista dados sem filtrar pelo tenant ativo da sessão.

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

- multi-tenancy com isolamento total de dados por `tenant_id`
- autenticação JWT com perfis `admin` e `gestor` **por tenant**, mais o escopo de plataforma `isGlobalAdmin`
- gestor visualiza apenas equipes sob sua gestão, dentro do tenant ativo
- múltiplos plantonistas simultâneos
- identificação de plantonistas atuais e próximos
- colaborador em férias aprovadas não aparece como plantonista atual
- escalas 12x36, 5x2 e personalizadas

## Estrutura do repositório

- `backend/`: API REST e autenticação — `controllers/` (HTTP) → `services/` (regra de negócio) → `repositories/` (acesso a dados via Prisma, sempre recebendo `tenantId` explícito)
- `frontend/`: painel web corporativo — `/login` público, `/console` exclusivo do Administrador Global, demais rotas protegidas pelo grupo `(app)` e por `middleware.ts`
- `prisma/`: schema, migrations, `seed.ts` (idempotente, produção) e `seed.dev.ts` (destrutivo, só para desenvolvimento local — cria dois tenants para testar isolamento)
- `docker/`: Dockerfiles e compose espelhado

A migration `202607251900_multi_tenant_foundation` introduz `tenants`, `tenant_memberships` e a coluna `tenant_id` em toda tabela de domínio. Ela foi escrita à mão (não gerada automaticamente) para rodar em cima de uma base **já em produção, sem apagar nada**: cria um tenant "default", migra todo usuário/registro existente para ele (preservando papel e vínculo com colaborador) e só então torna as colunas obrigatórias.

## Testes

```bash
cd backend && npm test
```

Cobre login (credenciais válidas/inválidas/usuário inativo, único vínculo, múltiplos vínculos, Administrador Global), o middleware de autenticação (token ausente/inválido, role sem permissão, tenant ativo obrigatório, rotas exclusivas do Administrador Global), a resolução de escopo por equipe e — principalmente — que todo repositório filtra por `tenant_id`, incluindo o caso de um `id` que existe em outro tenant (deve retornar "não encontrado", nunca o registro de outro tenant).
