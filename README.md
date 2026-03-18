# Sistema de Gestão Operacional

Sistema full-stack pronto para produção para gestão de clientes, equipes, colaboradores, gestores, escalas, plantões e férias.

## Stack

- Frontend: Next.js 15 + React + TypeScript + Tailwind
- Backend: Node.js + Express + TypeScript + JWT
- Banco: PostgreSQL 16
- ORM: Prisma
- Deploy: Docker Compose

## Subida em produção com um único comando

```bash
docker-compose up -d --build
```

Após a subida:

- Frontend: `http://localhost:53000`
- Backend: `http://localhost:54000`
- Healthcheck: `http://localhost:54000/health`
- Admin padrão:
  - email: `admin@gestao.local`
  - senha: `Admin@123`
- Gestor de teste:
  - email: `gestor@gestao.local`
  - senha: `Gestor@123`

## O que acontece automaticamente no deploy

O container do backend executa automaticamente:

1. `prisma generate`
2. `prisma migrate deploy`
3. `npm run seed`
4. inicialização da API

Sem necessidade de:

- criar banco manualmente
- rodar SQL manual
- executar seed à mão
- configurar usuário inicial após o deploy

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

- `backend/`: API REST e autenticação
- `frontend/`: painel web corporativo
- `prisma/`: schema, migration e seed
- `docker/`: Dockerfiles e compose espelhado
