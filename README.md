# Gestão de Escalas e Plantões

Sistema completo para gestão de equipes, escalas, plantões e férias com backend em Node.js/TypeScript, frontend em Next.js e banco PostgreSQL via Prisma.

## Estrutura

- `backend/` API REST (Express + Prisma)
- `frontend/` Painel administrativo (Next.js + Tailwind)
- `prisma/` Modelo relacional, migrações e seed
- `docker/` Artefatos de containerização

## Variáveis de ambiente

Backend:

```env
DATABASE_URL=postgresql://user:pass@host:5432/db
APP_PORT=4000
APP_ENV=development
JWT_SECRET=change_me
```

Frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Execução local

```bash
cd backend
npm install
npx prisma migrate deploy --schema ../prisma/schema.prisma
npm run seed
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

## Principais endpoints

- `GET /health`
- `GET /api/plantonista/hoje`
- `GET /api/plantonista/agora`
- `GET /api/escala/data?data=YYYY-MM-DD`
- `GET /api/colaboradores`
- `GET /api/equipes`

## Regras de negócio aplicadas

- Impede escala durante férias
- Impede dois turnos no mesmo dia para o mesmo colaborador
- Plantões com período atravessando dias
- Feriados destacados para consumo no calendário

## Docker

- `docker/backend.Dockerfile`
- `docker/frontend.Dockerfile`
- `docker/docker-compose.yml`

> O PostgreSQL pode estar em container separado; ajuste `DATABASE_URL`.
