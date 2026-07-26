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

**Papéis padrão** (7, imutáveis): Administrador da Empresa, Gestor, Líder, Analista, Operador, Cliente e Visitante. Cada empresa pode criar **papéis próprios** com qualquer combinação das 41 permissões do catálogo.

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

### Ajuste avulso de turno

Quando a escala não prevê o caso — alguém não pode assumir e não há contrapartida nem tempo para o fluxo de troca — quem tem `shift.edit` remaneja o turno direto no calendário ou o cancela. A alteração fica na auditoria, e regerar a escala não a desfaz: o gerador preserva turnos com status diferente de `planejado`.

### Trocas de turno

Quando duas pessoas combinam trocar um dia específico:

1. **Solicitação** — quem pede escolhe o próprio turno e, na troca mútua, o turno do colega que vai assumir (ou pede **cobertura**, sem contrapartida). O motivo fica registrado.
2. **Aceite do colega** — o pedido só avança se a outra pessoa concordar.
3. **Aprovação** — quem tem `shift.approve_swap` aprova, e só então os turnos trocam de dono numa transação.

O turno resultante fica com status `trocado` e guarda quem estava escalado originalmente — o calendário mostra "era Ana", e nada do histórico se perde. Regerar a escala nunca sobrescreve turnos que vieram de troca aprovada.

## Dashboards montáveis

Além do painel operacional fixo, cada pessoa monta **seus próprios dashboards** escolhendo widgets de um catálogo:

| Widget | O que mostra |
| --- | --- |
| **Contador** | Um número em destaque — clientes, equipes, colaboradores, em turno agora, férias hoje, trocas pendentes, escalas ativas ou turnos nos próximos 7 dias. |
| **Em turno agora** | Quem está cobrindo neste instante, já descontando férias e ausências aprovadas. |
| **Próximos turnos** | O que vem a seguir no calendário. |
| **Trocas pendentes** | Pedidos aguardando aceite ou aprovação. |
| **Férias e ausências** | Quem fica indisponível na janela escolhida. |
| **Cobertura por dia** | Quantos turnos há em cada dia do período. |
| **Carga por colaborador** | Turnos e horas acumuladas por pessoa (turno que vira a meia-noite conta certo). |
| **Clientes e SLA** | Contato de escalation e SLA contratado. |
| **Nota** | Texto livre — procedimento de escalation, aviso do turno, link de runbook. |

Cada widget aceita título, largura (1 a 4 colunas), filtro de equipe e, conforme o tipo, período em dias e quantidade de itens.

O layout não guarda dados: guarda a **declaração** do que mostrar. Os números são resolvidos na hora da leitura — por isso uma versão antiga restaurada continua exibindo a operação de hoje, não a de quando foi salva.

### Versionamento

Salvar **publica uma versão nova**; a anterior continua no histórico. Restaurar também não apaga nada: republica o layout escolhido como a próxima versão, mantendo a linha do tempo íntegra e auditável.

## Compartilhamento de recursos

Um recurso (hoje, o dashboard) é compartilhado por **concessão de acesso**, em seis escopos:

| Escopo | Alcança |
| --- | --- |
| **Pessoa** | Um usuário específico da empresa. |
| **Equipe** | Quem gerencia a equipe e quem é membro dela. |
| **Papel** | Todos que exercem aquele papel na empresa. |
| **Empresa** | Todos os membros do tenant. |
| **Link público** | Quem tiver o link — sem login, sempre somente leitura. |
| **Plataforma** | Todas as empresas. Exclusivo do Administrador Global. |

Cada concessão tem um nível: **leitura**, **edição** ou **gestão** (quem pode compartilhar e remover). Quando duas concessões alcançam a mesma pessoa — a da equipe dela e uma nominal, por exemplo — vale a mais permissiva. O dono do recurso sempre tem gestão.

Compartilhar dá acesso ao **painel**, não aos dados: os widgets continuam respeitando o recorte de equipes de quem está olhando. Duas pessoas podem abrir o mesmo dashboard e ver números diferentes, e isso é intencional.

### Wallboard (`/d/<token>`)

O escopo *link público* gera uma URL sem sessão, somente leitura, com atualização automática a cada minuto — feita para a TV do NOC. O token é o segredo; revogar a concessão derruba o link na hora. Cada link é independente: revogar um não afeta os outros.

## Relatórios

Cinco relatórios operacionais, todos com filtro de período e de equipe, prévia na tela e exportação:

| Relatório | O que traz |
| --- | --- |
| **Escala por colaborador** | Turno a turno de cada pessoa, com horas e quem estava escalado antes de uma troca. |
| **Escala por equipe** | Cobertura consolidada por time e dia: turnos, pessoas distintas e horas. |
| **Horas por colaborador** | Turnos, dias com turno, horas acumuladas e média por turno. |
| **Trocas de turno** | Pedidos do período, com motivo, status, quem respondeu e quando. |
| **Férias e ausências** | Indisponibilidades que cruzam o período, com dias contados e status. |

O CSV sai pronto para o Excel em pt-BR: separador `;`, decimal com vírgula e BOM UTF-8 (sem ele, a acentuação abre quebrada). As datas vão em ISO no arquivo — ordena certo como texto e nenhuma planilha confunde dia com mês — e aparecem em dd/mm/aaaa na tela.

O recorte é o mesmo do resto do sistema: você só exporta as equipes que já enxerga, e pedir uma equipe fora do seu escopo devolve vazio em vez de vazar. Toda exportação fica na auditoria, com quantas linhas saíram e de onde.

## Segurança

- **Cabeçalhos.** `helmet` no backend e cabeçalhos explícitos no Next: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` e `Permissions-Policy`. Nenhum dos dois anuncia a tecnologia que roda por baixo.
- **CORS fechado por padrão.** O navegador nunca fala com a API direto — o frontend usa Server Components e um proxy server-side. Nenhuma origem é liberada a menos que `CORS_ORIGINS` diga o contrário.
- **Rate limit.** 10 tentativas de login por IP a cada 5 minutos (login bem-sucedido não gasta cota), 60/min no wallboard público — é o que impede adivinhar o token do link — e 300/min no restante da API.
- **CSRF.** As rotas `/api/*` do Next são autenticadas por cookie httpOnly, e o navegador o anexa sozinho até numa requisição vinda de outro site. Além do `SameSite=lax`, toda mudança de estado confere a origem e responde 403 quando ela não bate.
- **Sessão.** Token em cookie `httpOnly`, `secure` em produção, expirando em 12h. As permissões efetivas são buscadas do backend a cada requisição — nunca lidas do cookie, que o cliente poderia editar.
- **Corpo limitado** a 256 KB, e `trust proxy` configurado para que rate limit e auditoria vejam o IP real atrás do Coolify.

Ainda fora do escopo, e conscientemente: MFA/TOTP, SSO com Entra ID e Row-Level Security no Postgres (hoje o isolamento é garantido na aplicação, com testes que travam o contrato).

## Desempenho

A auditoria já pagina por cursor (`?take=&cursor=`), e os índices foram escolhidos medindo, não adivinhando — com `EXPLAIN ANALYZE` sobre uma base sintética de 500 mil registros de auditoria, 220 mil turnos e 30 mil de férias, distribuídos entre duas empresas de tamanhos bem diferentes:

- **`auditoria(tenant_id, id DESC)`** — a paginação ordena por `id DESC`. Sem o índice o Postgres varre a chave primária de trás para frente e descarta as linhas das outras empresas: numa que responde por 1/40 dos registros, eram ~1.900 linhas lidas para devolver 50. Com ele, zero descarte.
- **`ferias(tenant_id, status, data_fim)` e `ausencias(...)`** — a consulta de indisponibilidade roda a cada painel e a cada geração de turnos. A coluna que fecha o índice é `data_fim`, não `data_inicio`: é `data_fim >=` que descarta o histórico já encerrado, que é a maior parte da tabela. Com `data_inicio` o ganho era nulo — quase todo registro passado satisfaz `data_inicio <=`.

A consulta de turnos por período já era servida por `turnos(tenant_id, data)`, e o join com colaboradores resolve por chave primária com memoização — não precisou de índice novo.

## Integrações públicas

Cadastro de clientes preenche automaticamente a partir de APIs gratuitas, com o backend fazendo a chamada (evita CORS e padroniza a resposta):

- **CNPJ** → [BrasilAPI](https://brasilapi.com.br) com fallback para [Minha Receita](https://minhareceita.org). As duas servem a mesma base aberta da Receita, e nenhuma delas tem disponibilidade boa o suficiente para ser a única fonte. Os dígitos verificadores são validados localmente antes de gastar a chamada.
- **CEP** → BrasilAPI com fallback para [ViaCEP](https://viacep.com.br): logradouro, bairro, cidade e UF.

A resposta diz qual fonte respondeu, e isso aparece na tela e no log — sem essa informação, diagnosticar uma falha de consulta em produção vira adivinhação. Quando nenhuma fonte responde, a mensagem traz o motivo de cada uma (tempo esgotado, limite de consultas, HTTP tal) em vez de um "serviço indisponível" genérico.

Três detalhes que a integração precisa acertar e que não são óbvios:

- **User-Agent.** O `fetch` do Node não envia um por padrão, e a borda que serve a BrasilAPI trata requisição anônima como tráfego suspeito.
- **Tipos inconsistentes.** `cep` e `numero` chegam ora como string, ora como número — exigir string descartava o valor em silêncio e deixava o campo vazio mesmo com a consulta bem-sucedida.
- **Logradouro partido.** A Receita guarda o tipo separado do nome (`RUA` + `BELA VISTA`); usar só o segundo campo gravava o endereço sem o "RUA".

Se todas as fontes falharem, o formulário continua utilizável — os campos são apenas preenchidos manualmente.

## Módulos

| Módulo | O que faz |
| --- | --- |
| **Dashboard** | Quem está em turno agora, próximos turnos, trocas pendentes, férias e clientes. |
| **Meus painéis** | Dashboards montáveis com widgets, versionamento, favoritos, compartilhamento e wallboard público. |
| **Turnos** | Calendário semanal da operação, com status e rastreio de trocas. |
| **Trocas** | Fluxo completo de solicitação → aceite → aprovação. |
| **Escalas** | Regras de revezamento com faixas de horário e ordem da rotação. |
| **Clientes** | Cadastro completo com CNPJ/CEP, SLA, escalation e responsável interno — criar, editar e remover. |
| **Equipes / Colaboradores** | Estrutura da operação e disponibilidade para plantão/sobreaviso, com edição e remoção protegida por histórico. |
| **Férias e ausências** | Solicitação e aprovação; períodos aprovados viram conflito na geração de turnos. |
| **Usuários e papéis** | Gestão de acesso, atribuição de papéis e criação de papéis customizados. |
| **Relatórios** | Cinco relatórios operacionais com filtro de período e equipe, prévia e exportação em CSV. |
| **Auditoria** | Quem fez, o quê, quando, de onde — com estado antes/depois. |

## Exclusão protegida por histórico

Equipe e colaborador só são apagados de vez quando não deixam órfão. Quem já apareceu numa escala, tirou férias ou responde por um cliente tem registros que a auditoria e os relatórios referenciam — apagar reescreveria o passado.

Nesses casos a API responde **409** com o que exatamente segura a exclusão (`5 turno(s), 2 atribuição(ões) de escala, 1 cliente(s) sob sua responsabilidade`) e aponta a saída: **desativar**. O cadastro inativo sai da geração de turnos e das listas de seleção, e o histórico continua íntegro.

A mesma regra não vale para escala: removê-la é seguro porque os turnos já gerados sobrevivem — a chave estrangeira é `ON DELETE SET NULL`.

## Auditoria

Toda mutação relevante registra `tenant`, `ator`, `ação`, `entidade`, `antes`, `depois`, `IP` e `user-agent`. A escrita nunca derruba a operação que está auditando: falha de auditoria é logada, não propagada.

## Estrutura do repositório

- `backend/` — `controllers/` (HTTP) → `services/` (regra de negócio) → `repositories/` (Prisma, sempre com `tenantId` explícito)
- `frontend/` — `/login`, `/console` e `/d/<token>` (wallboard) públicos ao seu escopo; demais rotas protegidas pelo grupo `(app)`, por `middleware.ts` e por guarda de permissão em cada página
- `prisma/` — schema, migrations, `seed.ts` (idempotente) e `seed.dev.ts` (destrutivo, só local)
- `docker/` — Dockerfiles e compose espelhado

## Testes

```bash
cd backend && npm test
```

157 testes cobrindo:

- **Autenticação:** credenciais válidas/inválidas, usuário inativo, vínculo único, múltiplos vínculos, Administrador Global.
- **Autorização:** middleware de sessão, tenant ativo obrigatório, rotas exclusivas do Administrador Global, `requirePermission` com OR entre permissões.
- **Isolamento:** todo repositório filtra por `tenant_id` — inclusive o caso de um `id` que existe em outro tenant (retorna "não encontrado", nunca o dado alheio).
- **Gerador de turnos:** revezamento 12x36 com 2 e 3 pessoas, escala fixa 5x2, faixas sobrepostas, vigência de atribuições e alinhamento da rotação ao regerar períodos parciais.
- **Compartilhamento:** resolução do acesso efetivo (posse, papel, equipe, tenant, plataforma), a mais permissiva vencendo independentemente da ordem, destinatário de outra empresa recusado, escopo de plataforma restrito ao Administrador Global, promoção em vez de duplicata e expiração de link público.
- **Widgets:** filtro de equipe que não amplia o escopo do observador, cobertura por dia com dias vazios, carga com turno que vira a meia-noite, exclusão de quem está de férias e um widget que falha sem derrubar os vizinhos.
- **Relatórios:** cálculo de horas com turno que vira a meia-noite, agregação por equipe/dia, filtro por dia do turno cedido nas trocas, contagem inclusiva de dias e o escopo que não amplia com equipe de fora.
- **CSV:** BOM UTF-8, separador `;`, decimal com vírgula, aspas dobradas e campo com separador ou quebra de linha protegido.
- **Segurança:** cabeçalhos aplicados e teto de requisições anunciado.
- **Consulta de CNPJ/CEP:** dígitos verificadores, campos que chegam como número, logradouro partido em tipo + nome, telefone só com dígitos, fallback por tempo esgotado / limite de consultas / resposta vazia, 404 tratado como definitivo e o payload real de produção mapeado campo a campo.
- **Exclusão protegida:** equipe e colaborador com histórico recusados com o motivo detalhado, e apagados quando realmente não deixam órfão.
