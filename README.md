# Gestão Operacional

Plataforma **SaaS multi-tenant** para operações de monitoramento (NOC/Observabilidade): equipes, escalas com revezamento, turnos, trocas de plantão, clientes, RH e auditoria — com isolamento total de dados entre empresas.

## Stack

- **Frontend:** Next.js 15 (App Router) + React 18 + TypeScript + Tailwind
- **Backend:** Node.js + Express + TypeScript + JWT
- **Banco:** PostgreSQL 16 · **ORM:** Prisma
- **Deploy:** Docker Compose

## Subida em produção

1. Copie `.env.example` para `.env` e defina um `JWT_SECRET` forte (`openssl rand -hex 32`). O backend recusa subir sem essa variável.
2. Suba os containers:

```bash
docker-compose up -d --build
```

- Frontend: `http://localhost:4333` — abre em `/login`
- Backend: `http://localhost:54000` · Healthcheck: `/health`

Em uma base **vazia**, defina `SEED_ON_BOOT=true` (ou rode `docker compose exec backend npm run seed`) para criar a empresa inicial e os usuários de demonstração:

| Usuário | Acesso | Papel |
| --- | --- | --- |
| `admin@gestao.local` / `Admin@123` | Empresa Padrão + console da plataforma | Administrador Global |
| `gestor@gestao.local` / `Gestor@123` | Empresa Padrão | Gestor |

Troque essas senhas assim que possível — são apenas o bootstrap inicial.

O `entrypoint.sh` roda `prisma generate` → `prisma migrate deploy` → seed **opcional e idempotente** (só cria se o admin ainda não existir; nunca apaga nada) → inicialização da API.

Para resetar o dataset de demonstração em desenvolvimento local, use `npm run seed:dev:reset` em `backend/` — cria dois tenants para exercitar o isolamento e se recusa a rodar com `NODE_ENV=production`.

---

## Multi-tenancy

Cada empresa é um **tenant**. Toda tabela de domínio carrega `tenant_id`, e cada repositório do backend recebe o tenant explicitamente — nenhuma consulta lista dados sem esse filtro (travado por testes automatizados).

Um usuário é uma **identidade global** (e-mail único na plataforma) que pode ter vínculo — e papel diferente — em mais de uma empresa:

- **1 vínculo:** entra direto naquela empresa.
- **2+ vínculos:** o login mostra uma tela de seleção de empresa. A sessão fica presa à empresa escolhida até o próximo login.
- **Administrador Global:** não depende de vínculo. Entra no **console da plataforma** (`/console`), onde cria/edita/remove empresas e entra em qualquer uma delas. Dentro de uma empresa, um seletor no cabeçalho troca de contexto sem deslogar. Nenhum outro papel tem esse seletor.

## Controle de acesso (RBAC)

Autorização é por **permissão nomeada**, não por papel — as rotas usam `requirePermission('shift.approve_swap')`, e o papel é apenas um conjunto pré-montado de permissões.

**Papéis padrão** (7, imutáveis): Administrador da Empresa, Gestor, Líder, Analista, Operador, Cliente e Visitante. Cada empresa pode criar **papéis próprios** com qualquer combinação das 36 permissões do catálogo.

Além do papel, existem **overrides individuais** por usuário (`grant`/`deny`), que sempre vencem sobre o papel:

```
permissões efetivas = (∪ permissões dos papéis) + grants − denies
```

A proteção é em três camadas: o menu só mostra o que a pessoa pode acessar, a rota do frontend redireciona quem não tem permissão, e a API bloqueia de qualquer forma.

## Escalas e turnos

O modelo separa **regra** de **execução**:

- **Escala** é a regra: tipo, faixas de horário por dia da semana e a ordem do revezamento.
- **Turno** é o concreto: uma pessoa, um dia, um horário. É a unidade que aparece no calendário e que pode ser trocada.

Gerar turnos traduz a regra em dias concretos. O comportamento por tipo:

| Tipo | Como distribui |
| --- | --- |
| **12x36** | Revezamento diário — o colaborador da vez é `(dias desde o início) % nº de pessoas`. É o que faz duas pessoas se alternarem dia sim, dia não. |
| **5x2** | Escala fixa — todos os atribuídos trabalham em todos os dias definidos. |
| **Personalizada** | Revezamento por faixa — cada janela de horário do dia vai para o próximo da rotação. |

A geração é **idempotente e ancorada**: regerar só um pedaço do meio do período mantém o alinhamento do revezamento já combinado. Turnos que caem em férias/ausências aprovadas são criados mesmo assim, mas reportados como conflito para o gestor decidir a cobertura.

### Trocas de turno

Quando duas pessoas combinam trocar um dia específico:

1. **Solicitação** — quem pede escolhe o próprio turno e, na troca mútua, o turno do colega que vai assumir (ou pede **cobertura**, sem contrapartida). O motivo fica registrado.
2. **Aceite do colega** — o pedido só avança se a outra pessoa concordar.
3. **Aprovação** — quem tem `shift.approve_swap` aprova, e só então os turnos trocam de dono numa transação.

O turno resultante fica com status `trocado` e guarda quem estava escalado originalmente — o calendário mostra "era Ana", e nada do histórico se perde. Regerar a escala nunca sobrescreve turnos que vieram de troca aprovada.

## Integrações públicas

Cadastro de clientes preenche automaticamente a partir de APIs gratuitas, com o backend fazendo a chamada (evita CORS e padroniza a resposta):

- **CNPJ** → [BrasilAPI](https://brasilapi.com.br) (dados da Receita Federal): razão social, telefone e endereço. Os dígitos verificadores são validados localmente antes de gastar a chamada.
- **CEP** → BrasilAPI com fallback para [ViaCEP](https://viacep.com.br): logradouro, bairro, cidade e UF.

Se a consulta falhar, o formulário continua utilizável — os campos são apenas preenchidos manualmente.

## Módulos

| Módulo | O que faz |
| --- | --- |
| **Dashboard** | Quem está em turno agora, próximos turnos, trocas pendentes, férias e clientes. |
| **Turnos** | Calendário semanal da operação, com status e rastreio de trocas. |
| **Trocas** | Fluxo completo de solicitação → aceite → aprovação. |
| **Escalas** | Regras de revezamento com faixas de horário e ordem da rotação. |
| **Clientes** | Cadastro completo com CNPJ/CEP, SLA, escalation e responsável interno. |
| **Equipes / Colaboradores** | Estrutura da operação e disponibilidade para plantão/sobreaviso. |
| **Férias e ausências** | Solicitação e aprovação; períodos aprovados viram conflito na geração de turnos. |
| **Usuários e papéis** | Gestão de acesso, atribuição de papéis e criação de papéis customizados. |
| **Auditoria** | Quem fez, o quê, quando, de onde — com estado antes/depois. |

## Auditoria

Toda mutação relevante registra `tenant`, `ator`, `ação`, `entidade`, `antes`, `depois`, `IP` e `user-agent`. A escrita nunca derruba a operação que está auditando: falha de auditoria é logada, não propagada.

## Estrutura do repositório

- `backend/` — `controllers/` (HTTP) → `services/` (regra de negócio) → `repositories/` (Prisma, sempre com `tenantId` explícito)
- `frontend/` — `/login` e `/console` públicos ao seu escopo; demais rotas protegidas pelo grupo `(app)`, por `middleware.ts` e por guarda de permissão em cada página
- `prisma/` — schema, migrations, `seed.ts` (idempotente) e `seed.dev.ts` (destrutivo, só local)
- `docker/` — Dockerfiles e compose espelhado

## Testes

```bash
cd backend && npm test
```

64 testes cobrindo:

- **Autenticação:** credenciais válidas/inválidas, usuário inativo, vínculo único, múltiplos vínculos, Administrador Global.
- **Autorização:** middleware de sessão, tenant ativo obrigatório, rotas exclusivas do Administrador Global, `requirePermission` com OR entre permissões.
- **Isolamento:** todo repositório filtra por `tenant_id` — inclusive o caso de um `id` que existe em outro tenant (retorna "não encontrado", nunca o dado alheio).
- **Gerador de turnos:** revezamento 12x36 com 2 e 3 pessoas, escala fixa 5x2, faixas sobrepostas, vigência de atribuições e alinhamento da rotação ao regerar períodos parciais.
- **Validação de CNPJ:** dígitos verificadores, máscara e sequências repetidas.
