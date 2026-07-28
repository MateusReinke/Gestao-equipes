# Gestão Operacional

Plataforma **SaaS multi-tenant** para operações de monitoramento (NOC/Observabilidade): equipes, escalas com revezamento, turnos, trocas de plantão, clientes, RH e auditoria — com isolamento total de dados entre empresas.

## Stack

- **Frontend:** Next.js 15 (App Router) + React 18 + TypeScript + Tailwind
- **Backend:** Node.js + Express + TypeScript + JWT
- **Banco:** PostgreSQL 16 · **ORM:** Prisma
- **Deploy:** Docker Compose

## Subida em produção

1. Copie `.env.example` para `.env` e defina um `JWT_SECRET` forte (`openssl rand -hex 32`). O backend recusa subir sem essa variável.
2. Para usar o módulo de diretório, defina também `ENABLE_ENTRA_SYNC=true` e `DIRECTORY_ENCRYPTION_KEY` (`openssl rand -base64 32`).
3. Suba os containers:

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

### Responsáveis pela equipe

Quem responde por uma equipe não é rótulo: o vínculo (`gestor_equipes`) é o que
faz `getVisibleTeamIds` abrir a equipe para quem **não** administra a empresa —
é o que torna o papel Líder utilizável — e é para onde vão os alertas de férias
do time.

Define-se em **Equipes > Responsáveis**, marcando entre os usuários da empresa.
A validação é estrita: só usuário ativo com vínculo nesta empresa, porque
designar alguém concede acesso aos dados dela. Um id de fora é recusado com
`400` e nada é gravado — designação parcial silenciosa seria pior que o erro.

Fica sob `team.edit` por ser ato de organizar a operação, mas a auditoria o
registra como `permission_change`, que é o que ele de fato é.

Equipe sem responsável aparece marcada na lista: ninguém a enxerga fora de quem
administra a empresa, e os alertas de férias dela não têm destinatário.

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

## Controle de férias (CLT)

O que "vence" não são as férias — é o **período concessivo**. Cada ciclo tem duas janelas de 12 meses:

- **Aquisitivo** — 12 meses a partir da admissão. Ao fechar, o direito está adquirido (Art. 130).
- **Concessivo** — os 12 meses *seguintes*. É o prazo que a empresa tem para conceder (Art. 134). Estourar obriga a pagar o período em dobro (Art. 137).

**Os ciclos não são armazenados.** Derivam da data de admissão e são calculados na leitura — guardá-los exigiria manter sincronizado algo já determinístico, e uma falta lançada com atraso ou uma admissão corrigida deixariam o saldo errado em silêncio. Só o que não é derivável ganha tabela: o ajuste manual, que exige motivo e vai para a auditoria.

| Regra | Como se aplica |
| --- | --- |
| **Faltas injustificadas** (Art. 130) | Até 5 mantêm 30 dias; 6–14 caem para 24; 15–23 para 18; 24–32 para 12; acima disso o direito é perdido. A conta usa as ausências do tipo `falta` já aprovadas — nenhum lançamento novo. |
| **Abono pecuniário** (Art. 143) | Limitado a um terço do direito. |
| **Fracionamento** (Art. 134 §1) | Até 3 períodos, um com no mínimo 14 dias corridos e os demais com pelo menos 5. |
| **Início véspera de repouso** (Art. 134 §3) | Avisa, não bloqueia. Sem cadastro de feriados só dá para conferir o repouso semanal, e bloquear com meia regra daria falsa sensação de conformidade. |

Contrato importa: CLT e estágio geram direito; **PJ e terceirizado não** — o terceirizado tem férias com quem o contratou, não com você.

### Alertas de prazo

Quatro estados por ciclo: **direito adquirido** → **prazo próximo** (120 dias) → **crítico** (45) → **vencido**.

O horizonte é generoso de propósito. Numa operação 24×7, avisar 30 dias antes é inútil: não dá tempo de achar cobertura para um mês inteiro de plantão nem de respeitar o aviso prévio de 30 dias (Art. 135). A 120 dias ainda cabe planejar.

### Notificações

Chegam no sino do cabeçalho, em dois alcances distintos:

| Quem | Recebe | Como se define |
| --- | --- | --- |
| **Responsável pela equipe** | só do time dele | Equipes > Responsáveis |
| **RH** | de toda a empresa | permissão `hr.vacation.watch_all` |

A permissão do RH é separada de `hr.vacation.approve` de propósito: aprovar
férias e acompanhar o vencimento da empresa inteira são funções diferentes, e
`approve` é de Administrador **e** Gestor — usá-la faria todo gestor receber
alerta de gente que não é dele. Por padrão só o Administrador da Empresa a tem;
um papel de RH customizado ou um override individual estendem para quem precisa.

Ninguém mais é varrido: alerta que chega a quem não pode agir vira ruído, e
ruído faz o próximo alerta de verdade passar batido.

São **idempotentes por construção**: a chave identifica o fato (colaborador + ciclo + severidade), não o instante. A varredura pode rodar quantas vezes for preciso — inclusive em duas instâncias ao mesmo tempo — sem duplicar aviso. Mudar de severidade gera chave nova, que é o comportamento desejado: o agravamento merece um aviso novo.

Envio por e-mail ainda não existe; o modelo já está preparado para recebê-lo.

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
- **Rate limit.** 10 tentativas de login por IP a cada 5 minutos (login bem-sucedido não gasta cota), 60/min no wallboard público — é o que impede adivinhar o token do link —, 10/min no teste de conexão do diretório, porque cada chamada gasta a cota que a Microsoft mede no tenant do cliente, e 300/min no restante da API.
- **CSRF.** As rotas `/api/*` do Next são autenticadas por cookie httpOnly, e o navegador o anexa sozinho até numa requisição vinda de outro site. Além do `SameSite=lax`, toda mudança de estado confere a origem e responde 403 quando ela não bate.
- **Hash de senha nunca sai da API.** As consultas de vínculo selecionam campos explícitos do usuário; só o login lê `senhaHash`, e ele não devolve o registro. Antes, `include: { user: true }` fazia o hash da senha de um usuário recém-convidado voltar no corpo da resposta.
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

## Diretório (Microsoft Entra ID)

Sincronização organizacional com o provedor de identidade da empresa. Desligada por padrão: com `ENABLE_ENTRA_SYNC=false` as rotas respondem **503** e a tela avisa que o módulo não está habilitado neste ambiente.

### O princípio: espelho, não escrita direta

A garantia de que a sincronização não sobrescreve dado operacional não depende de disciplina de quem escreve o código — é estrutural.

```
Microsoft Graph → motor de sincronização → espelho (diretorio_*) ⇢ reconciliação ⇢ operação
                  (só conhece diretorio_*)                          (ponte única)
```

O motor escreve exclusivamente em `diretorio_pessoas`, `diretorio_departamentos`, `diretorio_cargos`, `diretorio_execucoes` e `diretorio_execucao_eventos`. Escalas, turnos, férias, plantões, aprovações, clientes, SLA e indicadores não são alcançáveis a partir dele. A única travessia é `diretorio_pessoas.colaborador_id`, e atravessá-la é ato explícito da reconciliação, com lista fechada de campos e trava por campo.

Um teste (`modules/directory/__tests__/isolamento.test.ts`) lê os arquivos do módulo e quebra o build se alguém importar repositório operacional fora da lista de exceções declarada. Provedores também não podem importar Prisma como valor — eles traduzem payload, não persistem.

Efeito colateral desejado: um diretório de 5.000 contas não vira 5.000 colaboradores. Tudo entra no espelho (barato, isolado, sem efeito); virar colaborador é decisão de quem opera.

### Credenciais por empresa, cifradas

Cada cliente do SaaS tem o próprio tenant Entra e a própria App Registration — credencial em `.env` limitaria a plataforma inteira a um único cliente. Por isso o ambiente guarda só o interruptor e a chave mestra; tenant, client id e secret ficam em `diretorio_conexoes`, por empresa.

O `clientSecret` é gravado com **AES-256-GCM**, versionado (`v1.iv.tag.ct`) e com a empresa como dado autenticado adicional — um pacote cifrado para a empresa 7 não decifra como se fosse da 9, então copiar a linha entre tenants falha em vez de funcionar em silêncio. O segredo **nunca** sai da API: a tela recebe uma impressão digital de 8 caracteres, o suficiente para conferir "é o mesmo que cadastrei?".

Trocar `DIRECTORY_ENCRYPTION_KEY` torna ilegíveis os segredos já gravados. A tela detecta isso (`segredoIlegivel`) e pede o recadastro em vez de exibir um "configurado" que não funciona.

### Teste de conexão como instrumento de diagnóstico

Dá para testar **antes de salvar** — quem monta uma App Registration erra na primeira tentativa quase sempre, e obrigar a gravar credencial errada para descobrir que está errada seria hostil.

Cada permissão é verificada em separado, porque o consentimento de administrador costuma ser concedido pela metade e um "falhou" único deixaria quem configura adivinhando qual liberar:

| Recurso | Permissão | |
| --- | --- | --- |
| Usuários | `User.Read.All` | obrigatória |
| Organização | `Organization.Read.All` | opcional — confirma que as credenciais apontam para o tenant certo |
| Grupos | `Group.Read.All` | opcional |

Os códigos `AADSTS` mais comuns viram instrução acionável em vez do parágrafo em inglês com trace id: segredo inválido aponta para o campo *Value* (e não *Secret ID*); segredo vencido manda gerar outro em *Certificates & secrets*; tenant não encontrado avisa que o campo é um GUID, não o nome do domínio.

### A carga

**Equipes > Diretório > Sincronizar agora** faz a leitura completa: percorre
`/users` paginado, grava página a página no espelho e, ao final, deriva os
catálogos e marca quem não veio.

Três decisões que moldam o comportamento em falha:

- **Grava por página, não ao final.** Num tenant de milhares de contas,
  acumular tudo em memória transformaria uma queda no meio em "nada foi salvo".
  Assim, uma interrupção deixa a execução `parcial` — o que entrou continua
  valendo, e a próxima completa o resto.
- **Ausentes só são marcados com a leitura inteira concluída.** Marcar a partir
  de uma leitura interrompida apagaria do espelho quem apenas não chegou a ser
  lido.
- **Uma pessoa que falha ao gravar não derruba a carga.** O conflito fica
  registrado com nome e Object ID, e o resto do diretório entra. Ela também
  fica de fora da lista de presentes — não temos como afirmar que está lá.

Contas desabilitadas entram por padrão (`SYNC_DISABLED_USERS`): sumir com elas
apagaria o nome de quem aparece no histórico de escalas. Quem sai do diretório
recebe `removido_em`, nunca `DELETE` — e o vínculo com colaborador, se houver,
sobrevive intacto.

### Incremental, e o que fazer quando o cursor morre

Toda leitura passa por `/users/delta`, inclusive a completa — é o único endpoint
que devolve, na última página, o `@odata.deltaLink` que serve de cursor para a
próxima execução. Uma carga por `/users` comum leria tudo e não deixaria por
onde continuar.

O preço é não poder filtrar contas desabilitadas no servidor (o delta aceita um
conjunto restrito de filtros). Elas vêm e o motor decide — o que, aliás, é a
única forma correta: filtrar na origem faria a leitura incremental **nunca ver**
quem acabou de ser desabilitado, e o espelho o afirmaria ativo para sempre.

Duas diferenças entre os modos que não são detalhe:

- **A completa deduz saídas por ausência**; a incremental **não**. O delta só
  traz quem mudou, então deduzir ali marcaria como removida quase a empresa
  inteira. Na incremental, a saída vem sinalizada pelo próprio provedor.
- **Cursor novo só é guardado com a leitura fechada.** Guardá-lo depois de uma
  interrupção faria a execução seguinte pular o que faltou.

Quando o Graph responde **410** (`syncStateNotFound`), o cursor venceu — delta
parado por ~30 dias, ou mudança de configuração do tenant. Não é falha: é
"recomece do zero", e o motor recomeça sozinho, registra o motivo e marca a
execução como completa. Sem isso, a sincronização morreria em silêncio e
ninguém perceberia por semanas.

A condição mora no contrato como `CursorExpiradoError`, não na implementação do
Entra: Google e LDAP têm a mesma condição com outro nome, e o motor precisa
reagir a uma coisa só.

### Agendador

Roda no processo da própria API, sem infraestrutura nova: acorda a cada minuto,
olha quais conexões venceram o **intervalo da própria empresa** e sincroniza em
série — disparar todas de uma vez faria do backend uma fonte de rajadas contra
o limite de taxa da Microsoft, que é medido por aplicação.

A pergunta óbvia, "e se houver duas instâncias?", é respondida por uma trava de
reivindicação em `diretorio_conexoes.sincronizando_desde`, por comparação-e-troca
atômica (`UPDATE ... WHERE sincronizando_desde IS NULL`). As duas acordam, as
duas tentam, uma ganha e a outra segue em frente. Sem fila, sem lock
distribuído, sem cron externo para operar.

Reivindicação com mais de uma hora conta como abandonada — um processo morto no
meio de uma carga não pode travar a conexão para sempre. E a liberação está em
`finally`: exceção inesperada não deixa a conexão presa.

Conexão nunca sincronizada vence imediatamente, para ativar não significar
esperar um intervalo inteiro até ver o primeiro dado.

### Departamento e cargo são derivados, não sincronizados

No Microsoft Graph `department` e `jobTitle` são strings livres no usuário — não existe endpoint `/departments`. O catálogo é montado a partir dos valores distintos encontrados, e "departamento deixou de existir" significa que nenhuma pessoa ativa o referencia mais: marca `ativo = false`, nunca `DELETE`. Como é texto livre, erro de digitação no diretório cria departamento novo, e `mesclado_em_id` permite unificar dois registros sem perder o histórico de qual grafia veio do provedor.

Cargo é informativo por definição: quem controla permissão nesta aplicação é o papel do RBAC, atribuído aqui dentro.

### A ponte com o cadastro

O espelho vira cadastro por **vínculo**, e vínculo é ato de gente: em
**Diretório > Vínculo com o cadastro**, escolhe-se o colaborador para cada
pessoa. Antes de aplicar, a tela mostra o que mudaria — usando a mesma função
de decisão que a gravação, então a prévia não tem como mentir.

Coincidência de e-mail vira **sugestão**, nunca vínculo. O vínculo gravado é
sempre por Object ID; o e-mail só ajuda um humano a reconhecer a pessoa uma
vez. Endereço é reciclado, e ligar por ele automaticamente entregaria o
histórico de alguém a outra pessoa.

Toda a travessia mora em `sync/reconcile.service.ts` — o **único** arquivo do
módulo que importa repositório operacional, com o teste de fronteira
garantindo que continue assim. Concentrar num lugar só é o que torna a promessa
verificável: "a sincronização não sobrescreve dado operacional" não é uma
intenção espalhada, é uma lista de campos que cabe numa tela.

| | Campos | Comportamento |
| --- | --- | --- |
| **Diretório manda** | nome, e-mail, cargo | reescritos a cada execução |
| **Preenche se vazio** | telefone | não sobrescreve o que o RH corrigiu |
| **Nunca tocados** | equipe, contrato, modelo de trabalho, plantão, sobreaviso, **admissão**, **desligamento**, nascimento, matrícula, CPF | fora da lista, logo inalcançáveis |

Nulo do diretório não apaga o que o cadastro tem: ausência de informação não é
informação de ausência.

**Trava por campo.** Se o diretório está errado e o cadastro está certo, trave
o campo no vínculo e a sincronização passa a pulá-lo, registrando que pulou.
Só é possível travar o que a sincronização de fato escreve — travar
`dataAdmissao` daria falsa sensação de proteção, já que ela é intocável por
construção.

### Conta desabilitada mexe em `ativo`, jamais em desligamento

Com `AUTO_DISABLE_USERS` ligada, conta desabilitada (ou pessoa que saiu do
diretório) marca o colaborador como inativo — e **só isso**. `dataDesligamento`
continua sendo ato humano no cadastro funcional: gravá-la aqui truncaria o
período aquisitivo e reduziria direito a férias em silêncio.

A reativação também é automática, o que cria um caso a conhecer: se alguém
desativar um colaborador por motivo operacional enquanto o diretório o mostra
ativo, a próxima execução o reativa. A saída é travar o campo `ativo` — por
isso ele está entre os travávies.

### Criação automática, e as duas recusas dela

`AUTO_CREATE_USERS` cria colaborador para quem ainda não tem, na equipe de
entrada da conexão. Recusa dois casos de propósito:

- **Conta desabilitada não vira colaborador** — cadastro para quem já perdeu o
  acesso só polui a lista de escala.
- **E-mail que já existe em outro colaborador vira conflito, não vínculo.**
  É o mesmo princípio da sugestão: a decisão de que "são a mesma pessoa" é de
  um humano.

O colaborador criado nasce com o padrão mais conservador — CLT presencial, sem
plantão nem sobreaviso — porque entrar na escala de plantão por omissão é pior
que corrigir depois. E **sem data de admissão**: o diretório não sabe quando a
pessoa foi contratada, e chutar essa data corromperia o cálculo de férias.

### Desvincular não desfaz

Desvincular significa "pare de atualizar", não "desfaça o que foi feito":
reverter exigiria saber o valor anterior de cada campo, e o cadastro não é
versionado. O colaborador permanece como está, inclusive com o que a
sincronização já escreveu nele.

### Duas coisas diferentes chamadas "gestor"

| | Origem | Forma | Significado |
| --- | --- | --- | --- |
| `manager` do Entra | sincronizado | pessoa → pessoa | hierarquia de RH |
| `gestor_equipes` | da aplicação | usuário → equipe | quem responde pela operação |

Não são deriváveis um do outro: o gestor de RH de um analista pode não ser o responsável pela equipe de plantão dele. O `manager` do Entra alimenta o organograma e **sugere** vínculos, sempre confirmados por uma pessoa.

### Conta desabilitada não é desligamento

`accountEnabled = false` pode ser licença médica, afastamento ou suspensão de licença — não só saída. Se `AUTO_DISABLE_USERS` gravasse `data_desligamento`, o cálculo de férias truncaria o período aquisitivo e **reduziria direito adquirido em silêncio**.

Então a flag grava **apenas** `colaboradores.ativo = false`: histórico preservado, escalas antigas preservadas, auditoria preservada, novos vínculos operacionais bloqueados, consulta permitida. `data_desligamento` continua sendo ato humano no cadastro funcional.

### Permissões

| Permissão | Papéis padrão |
| --- | --- |
| `directory.view` | Administrador da Empresa, Gestor |
| `directory.manage` (credenciais) | Administrador da Empresa |
| `directory.sync` | Administrador da Empresa, Gestor |
| `directory.reconcile` | Administrador da Empresa, Gestor |

Configurar credencial é separado de ver o diretório de propósito: o Gestor acompanha e reconcilia, mas não vê nem troca segredo.

### Estado atual

Entregue: schema do espelho, conexão por empresa com segredo cifrado, contrato
`DirectoryProvider` (com o Entra como primeira implementação), cliente Graph com
paginação e `Retry-After` honrado, teste de conexão, carga completa de pessoas
com catálogos derivados, **sincronização incremental com queda automática para
completa quando o cursor expira**, **agendador com trava de concorrência** e a
tela do espelho em leitura, e a **reconciliação com o cadastro** — vínculo com
prévia, promoção a colaborador, travas por campo e as duas automações opcionais.

Enquanto ninguém vincula, a sincronização não escreve uma linha operacional. O
que muda isso é um ato explícito por pessoa, não um efeito colateral.

Nada disso alcança dado operacional: o espelho é réplica, e a ponte para o
cadastro só nasce na reconciliação.

Remover uma conexão apaga o espelho em cascata — é réplica, e uma nova sincronização traz tudo de volta. Já uma conexão com pessoas vinculadas a colaboradores responde **409** com a contagem, porque vínculo é decisão de gente: para só parar de sincronizar, desative a conexão.

Ainda não entregue: grupos, organograma e fotos.

## Módulos

| Módulo | O que faz |
| --- | --- |
| **Dashboard** | Quem está em turno agora, próximos turnos, trocas pendentes, férias e clientes. |
| **Meus painéis** | Dashboards montáveis com widgets, versionamento, favoritos, compartilhamento e wallboard público. |
| **Turnos** | Calendário semanal da operação, com status e rastreio de trocas. |
| **Trocas** | Fluxo completo de solicitação → aceite → aprovação. |
| **Escalas** | Regras de revezamento com faixas de horário e ordem da rotação. |
| **Clientes** | Cadastro completo com CNPJ/CEP, SLA, escalation e responsável interno — criar, editar e remover. |
| **Equipes / Colaboradores** | Estrutura da operação, responsáveis por equipe e disponibilidade para plantão/sobreaviso, com edição e remoção protegida por histórico. |
| **Férias e ausências** | Solicitação e aprovação; períodos aprovados viram conflito na geração de turnos. |
| **Controle de férias** | Ciclos aquisitivo/concessivo por pessoa, saldo, prazo e alertas de vencimento pela CLT. |
| **Usuários e papéis** | Gestão de acesso, atribuição de papéis e criação de papéis customizados. |
| **Relatórios** | Cinco relatórios operacionais com filtro de período e equipe, prévia e exportação em CSV. |
| **Diretório** | Conexão com o Microsoft Entra ID: credenciais cifradas por empresa e diagnóstico de permissões. |
| **Auditoria** | Quem fez, o quê, quando, de onde — com estado antes/depois. |

## Exclusão protegida por histórico

Equipe e colaborador só são apagados de vez quando não deixam órfão. Quem já apareceu numa escala, tirou férias ou responde por um cliente tem registros que a auditoria e os relatórios referenciam — apagar reescreveria o passado.

Nesses casos a API responde **409** com o que exatamente segura a exclusão (`5 turno(s), 2 atribuição(ões) de escala, 1 cliente(s) sob sua responsabilidade`) e aponta a saída: **desativar**. O cadastro inativo sai da geração de turnos e das listas de seleção, e o histórico continua íntegro.

A mesma regra não vale para escala: removê-la é seguro porque os turnos já gerados sobrevivem — a chave estrangeira é `ON DELETE SET NULL`.

## Auditoria

Toda mutação relevante registra `tenant`, `ator`, `ação`, `entidade`, `antes`, `depois`, `IP` e `user-agent`. A escrita nunca derruba a operação que está auditando: falha de auditoria é logada, não propagada.

## Estrutura do repositório

- `backend/` — `controllers/` (HTTP) → `services/` (regra de negócio) → `repositories/` (Prisma, sempre com `tenantId` explícito)
- `backend/src/modules/directory/` — módulo autocontido (provedores, cifragem, repositório e rotas próprias), com fronteira verificada por teste
- `frontend/` — `/login`, `/console` e `/d/<token>` (wallboard) públicos ao seu escopo; demais rotas protegidas pelo grupo `(app)`, por `middleware.ts` e por guarda de permissão em cada página
- `prisma/` — schema, migrations, `seed.ts` (idempotente) e `seed.dev.ts` (destrutivo, só local)
- `docker/` — Dockerfiles e compose espelhado

## Testes

```bash
cd backend && npm test
```

396 testes cobrindo:

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
- **Férias pela CLT:** montagem dos ciclos com admissão em fim de mês e em 29 de fevereiro, tabela de faltas nas bordas exatas, abono de um terço, fracionamento válido e inválido, saldo que nunca fica negativo, e classificação de férias antigas pelo período concessivo.
- **Responsáveis por equipe:** usuário de outra empresa recusado sem gravar nada (é o vínculo que abre visibilidade), usuário inativo recusado, duplicata removida antes da unique do banco, lista vazia limpando os responsáveis e o retorno vindo do estado gravado, não do que foi enviado.
- **Destinatários dos alertas:** equipe sem responsável gera alerta que não vai a ninguém, responsável de uma equipe não recebe da outra, RH recebe de todas inclusive das sem responsável, quem é as duas coisas recebe uma notificação só, e a consulta usa a permissão dedicada e não a de aprovar férias.
- **Alertas de prazo:** transição entre os quatro estados nos dias exatos do horizonte, um alerta por ciclo (o mais grave), chave de idempotência estável entre execuções e nova quando a severidade muda.
- **Validação de CPF:** dígitos verificadores, máscara, sequências repetidas e o caso em que o resto do cálculo é 10.
- **Cifragem do diretório:** ida e volta, pacote diferente a cada gravação, recusa com contexto de outra empresa, texto e tag adulterados, versão desconhecida, e as três formas de chave (hex, base64 e frase derivada) — inclusive a exigência de a derivação abrir, depois de um restart, o que foi gravado antes.
- **Cliente Graph:** reaproveitamento do token, tradução dos códigos AADSTS, `Retry-After` em segundos e em formato de data, 401 que descarta o token e repete, repetição em erro de servidor e 400 que não é repetido.
- **Teste de conexão:** permissão obrigatória ausente reprova, opcional ausente não reprova, credencial recusada nem chega a verificar permissão, e cada recurso verificado em separado.
- **Conexão de diretório:** segredo nunca sai na resposta, domínio recusado no lugar do GUID, criação automática barrada sem equipe de entrada, edição sem segredo preserva o guardado, troca de credencial invalida o teste anterior e remoção segurada por vínculo com colaborador.
- **Rotas do diretório:** com o módulo desligado, listar/criar/testar respondem 503 com a instrução — e não 200 vazio, que sugeriria "está ligado, só não configurado" —, a guarda de sessão vem antes da de habilitação para que ninguém descubra sem se autenticar se a empresa usa diretório, e o 503 precede a validação do corpo.
- **Motor de sincronização:** primeira carga contando criações, reexecução contando atualizações, quem sumiu virando removido, catálogos derivados do espelho gravado (e não da resposta), contas desabilitadas dentro e fora conforme a opção, leitura interrompida que não marca ausentes nem grava cursor, pessoa que falha sem derrubar a carga e sem entrar na lista de presentes, recusa de execução concorrente, e log desligado que ainda registra o erro.
- **A lista fechada:** nenhuma mudança calculada toca campo operacional, `dataDesligamento` intocada mesmo com a conta desabilitada, e só é travável o que a sincronização de fato escreve.
- **Precedência de campos:** diretório manda em nome/e-mail/cargo, nulo não apaga o que o cadastro tem, valor igual não vira mudança, telefone só preenche quando vazio e cai no celular quando não há comercial.
- **Travas:** campo travado não muda mesmo divergindo, e travar `ativo` impede a auto-desativação.
- **`ativo`:** desabilitada desativa, saída do diretório desativa, reabilitada reativa, e com a opção desligada `ativo` nunca é tocado.
- **Reconciliação:** grava só o que mudou, colisão de e-mail vira conflito em vez de gravação forçada, uma pessoa com problema não interrompe as demais, e vínculo órfão aparece como conflito.
- **Criação automática:** cria e vincula quem não existe, nasce sem plantão e sem admissão, e-mail já existente vira conflito e não vínculo, conta desabilitada e pessoa sem e-mail são recusadas.
- **A ponte na sincronização:** com as opções desligadas nada é criado nem desativado, criação automática sem equipe de entrada avisa em vez de silenciar, e leitura interrompida não reconcilia.
- **Leitura incremental:** usa o cursor guardado e se declara incremental, não deduz saída por ausência, respeita o marcador de saída explícita, e o modo completa forçado ignora o cursor.
- **Cursor expirado:** recomeça do zero sozinho, registra o motivo, fecha a execução como completa (não como a incremental que começou) e volta a deduzir ausências.
- **Trava de concorrência:** recusa quando outra execução já reivindicou, e libera a trava tanto no caminho feliz quanto quando a execução estoura.
- **Agendador:** conexão nunca sincronizada vence na hora, intervalo é o da própria empresa (com queda para o padrão quando o valor é lixo), ocupada e inativa são puladas, reivindicação órfã de mais de uma hora não segura a conexão, perder a corrida pela trava não é erro, uma empresa com problema não impede as seguintes, e a sincronização é em série.
- **Mapeamento do Entra:** e-mail de caixa preferido ao login, queda para o login quando não há caixa, primeiro telefone da lista, string em branco tratada como ausente, conta de serviço sem nome caindo no login, objeto sem Object ID descartado, `accountEnabled` ausente tratado como habilitada e o marcador de exclusão do delta.
- **Fronteira diretório/operação:** nenhum arquivo do módulo importa repositório operacional fora da lista declarada, provedores não importam Prisma como valor, e o repositório do módulo só lê de tabela operacional.
