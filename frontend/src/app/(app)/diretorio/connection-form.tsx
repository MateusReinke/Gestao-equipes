'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, KeyRound, Plug, RefreshCw, X } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Input, Select } from '@/components/ui';
import { DeleteButton } from '@/components/delete-button';
import type { Conexao, Equipe, OpcoesDiretorio, ResultadoTeste } from './types';

/**
 * Formulário da conexão com o provedor de identidade.
 *
 * Duas decisões moldam esta tela:
 *
 * 1. Dá para testar ANTES de salvar. Quem está montando a App Registration
 *    erra na primeira tentativa quase sempre, e obrigar a gravar credencial
 *    errada para descobrir que está errada seria hostil.
 *
 * 2. O segredo nunca volta do servidor. Quando já existe um salvo, o campo
 *    fica fechado e mostra a impressão digital — trocar é ato explícito.
 */

const PADRAO: OpcoesDiretorio = {
  sincronizarUsuarios: true,
  sincronizarDepartamentos: true,
  sincronizarCargos: true,
  sincronizarGestores: true,
  sincronizarFotos: false,
  sincronizarGrupos: false,
  sincronizarUsuariosDesabilitados: true,
  autoCriarColaboradores: false,
  autoDesativarColaboradores: false,
  logOperacoes: true,
  sincronizacaoCompletaNaPrimeira: true,
  intervaloMinutos: 60,
  paisPadrao: 'BR',
  fusoHorarioPadrao: 'America/Sao_Paulo',
  idiomaPadrao: 'pt-BR',
};

type Campo = { chave: keyof OpcoesDiretorio; label: string; descricao: string };

const O_QUE_LER: Campo[] = [
  { chave: 'sincronizarUsuarios', label: 'Pessoas', descricao: 'Nome, e-mail, cargo, departamento e status da conta.' },
  { chave: 'sincronizarDepartamentos', label: 'Departamentos', descricao: 'Catálogo derivado dos valores encontrados nas pessoas.' },
  { chave: 'sincronizarCargos', label: 'Cargos', descricao: 'Também derivado. Informativo: cargo não define permissão aqui.' },
  { chave: 'sincronizarGestores', label: 'Hierarquia de gestores', descricao: 'Monta o organograma. Exige uma consulta a mais por pessoa.' },
  { chave: 'sincronizarGrupos', label: 'Grupos', descricao: 'Grupos do diretório e seus membros.' },
  { chave: 'sincronizarFotos', label: 'Fotos', descricao: 'Uma requisição por pessoa — roda em cadência própria, mais lenta.' },
  {
    chave: 'sincronizarUsuariosDesabilitados',
    label: 'Contas desabilitadas',
    descricao: 'Mantém quem saiu no espelho. Desligar apaga o nome de quem aparece no histórico de escalas.',
  },
];

const EFEITOS: Campo[] = [
  {
    chave: 'autoCriarColaboradores',
    label: 'Criar colaboradores automaticamente',
    descricao: 'Toda pessoa nova do diretório vira colaborador na equipe de entrada. Sem isso, você escolhe quem é da operação.',
  },
  {
    chave: 'autoDesativarColaboradores',
    label: 'Desativar quem for desabilitado no diretório',
    descricao: 'Marca o colaborador como inativo. Não registra desligamento — conta desabilitada também é afastamento, e isso mudaria o cálculo de férias.',
  },
];

function Interruptor({
  checked,
  onChange,
  label,
  descricao,
  destaque,
}: {
  checked: boolean;
  onChange: (valor: boolean) => void;
  label: string;
  descricao: string;
  destaque?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
        destaque && checked ? 'border-warn/40 bg-warn-soft' : 'border-line hover:bg-surface-hover'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(evento) => onChange(evento.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-accent"
      />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-2xs leading-relaxed text-ink-muted">{descricao}</span>
      </span>
    </label>
  );
}

export function ConnectionForm({ conexao, equipes }: { conexao: Conexao | null; equipes: Equipe[] }) {
  const router = useRouter();

  const [nome, setNome] = useState(conexao?.nome ?? 'Microsoft Entra ID');
  const [provedorTenantId, setProvedorTenantId] = useState(conexao?.provedorTenantId ?? '');
  const [clientId, setClientId] = useState(conexao?.clientId ?? '');
  const [clientSecret, setClientSecret] = useState('');
  const [authorityUrl, setAuthorityUrl] = useState(conexao?.authorityUrl ?? '');
  const [ativo, setAtivo] = useState(conexao?.ativo ?? false);
  const [equipePadraoId, setEquipePadraoId] = useState<string>(conexao?.equipePadrao?.id?.toString() ?? '');
  const [opcoes, setOpcoes] = useState<OpcoesDiretorio>(conexao?.opcoes ?? PADRAO);

  // Segredo já cadastrado fica fechado até alguém pedir para trocar. Se ele
  // não abre com a chave atual, não há o que preservar: já entra aberto.
  const [trocandoSegredo, setTrocandoSegredo] = useState(!conexao || conexao.segredoIlegivel);

  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [teste, setTeste] = useState<ResultadoTeste | null>(null);

  function ajustar<K extends keyof OpcoesDiretorio>(chave: K, valor: OpcoesDiretorio[K]) {
    setOpcoes((atual) => ({ ...atual, [chave]: valor }));
  }

  function corpo() {
    return {
      provider: 'entra' as const,
      nome,
      ativo,
      provedorTenantId: provedorTenantId.trim(),
      clientId: clientId.trim(),
      authorityUrl: authorityUrl.trim() || null,
      equipePadraoId: equipePadraoId ? Number(equipePadraoId) : null,
      opcoes,
      ...(clientSecret ? { clientSecret } : {}),
    };
  }

  async function testar() {
    setTestando(true);
    setErro(null);
    setSucesso(null);
    setTeste(null);

    // Conexão salva testa pelo id (e o resultado fica registrado nela).
    // Rascunho testa pela rota avulsa, que não grava nada.
    const rota = conexao ? `/api/diretorio/conexoes/${conexao.id}/testar` : '/api/diretorio/conexoes/testar';

    try {
      const response = await fetch(rota, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'entra',
          provedorTenantId: provedorTenantId.trim(),
          clientId: clientId.trim(),
          authorityUrl: authorityUrl.trim() || null,
          ...(clientSecret ? { clientSecret } : {}),
        }),
      });

      const dados = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErro(dados.error || 'Não foi possível testar a conexão.');
        return;
      }

      setTeste(dados as ResultadoTeste);
      if (conexao) router.refresh();
    } catch {
      setErro('Falha de comunicação ao testar a conexão.');
    } finally {
      setTestando(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSucesso(null);

    try {
      const response = await fetch(
        conexao ? `/api/diretorio/conexoes/${conexao.id}` : '/api/diretorio/conexoes',
        {
          method: conexao ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corpo()),
        }
      );

      const dados = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detalhes = dados.issues
          ? Object.values(dados.issues as Record<string, string[]>)
              .flat()
              .join(' ')
          : '';
        setErro([dados.error, detalhes].filter(Boolean).join(' — ') || 'Não foi possível salvar.');
        return;
      }

      setClientSecret('');
      setTrocandoSegredo(false);
      setSucesso(conexao ? 'Configuração salva.' : 'Conexão criada.');
      router.refresh();
    } catch {
      setErro('Falha de comunicação ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const podeTestar = Boolean(provedorTenantId.trim() && clientId.trim() && (clientSecret || conexao));

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader
          title="Credenciais"
          description="Os dados da App Registration criada no portal do Entra ID."
          action={
            conexao ? (
              <Badge tone={conexao.ativo ? 'ok' : 'neutral'}>{conexao.ativo ? 'Ativa' : 'Inativa'}</Badge>
            ) : null
          }
        />
        <CardBody className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da conexão" htmlFor="nome" hint="Como ela aparece nesta tela.">
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </Field>

            <Field
              label="Directory (tenant) ID"
              htmlFor="tenant"
              hint="O GUID do tenant no Entra — não o nome do domínio."
            >
              <Input
                id="tenant"
                value={provedorTenantId}
                onChange={(e) => setProvedorTenantId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                spellCheck={false}
                className="tabular"
              />
            </Field>

            <Field label="Application (client) ID" htmlFor="client" hint="GUID da App Registration.">
              <Input
                id="client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                spellCheck={false}
                className="tabular"
              />
            </Field>

            <Field
              label="Client secret"
              htmlFor="segredo"
              hint={trocandoSegredo ? 'Copie o campo "Value" do segredo, não o "Secret ID".' : undefined}
            >
              {trocandoSegredo ? (
                <Input
                  id="segredo"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="••••••••••••••••"
                  autoComplete="off"
                  spellCheck={false}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="input-base flex items-center gap-2 text-xs text-ink-muted">
                    <KeyRound size={13} className="shrink-0" />
                    Cadastrado
                    {conexao?.segredoImpressao ? (
                      <span className="tabular text-ink-subtle">({conexao.segredoImpressao})</span>
                    ) : null}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setTrocandoSegredo(true)}>
                    Trocar
                  </Button>
                </div>
              )}
            </Field>
          </div>

          {conexao?.segredoIlegivel ? (
            <Alert tone="warn">
              O segredo salvo não abre com a chave de criptografia atual do servidor. Isso acontece quando
              DIRECTORY_ENCRYPTION_KEY muda depois da gravação — cadastre o segredo novamente.
            </Alert>
          ) : null}

          <details className="rounded-lg border border-line px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-ink-muted">Opções avançadas</summary>
            <div className="pt-3">
              <Field
                label="Authority URL"
                htmlFor="authority"
                hint="Só para nuvens soberanas ou ambiente de teste. Em branco usa o padrão do servidor."
              >
                <Input
                  id="authority"
                  value={authorityUrl}
                  onChange={(e) => setAuthorityUrl(e.target.value)}
                  placeholder="https://login.microsoftonline.com"
                  spellCheck={false}
                />
              </Field>
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={testar} disabled={!podeTestar || testando}>
              <Plug size={14} /> {testando ? 'Testando...' : 'Testar conexão'}
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : conexao ? 'Salvar alterações' : 'Criar conexão'}
            </Button>
            {!conexao ? (
              <span className="text-2xs text-ink-subtle">Testar não salva nada — dá para conferir antes.</span>
            ) : null}
            {conexao ? (
              <div className="ml-auto">
                {/* O 409 do backend (pessoas já vinculadas a colaboradores) chega
                    inteiro aqui: é ele que diz quantas são e sugere desativar. */}
                <DeleteButton
                  url={`/api/diretorio/conexoes/${conexao.id}`}
                  rotulo="Remover conexão"
                  confirmacao="Remover? O que já foi lido do diretório é apagado junto."
                />
              </div>
            ) : null}
          </div>

          {conexao ? (
            <p className="text-2xs leading-relaxed text-ink-subtle">
              Remover apaga o espelho do diretório desta empresa — pessoas, departamentos, cargos e histórico de
              execuções. Nada disso é perdido de verdade: uma nova sincronização traz tudo de volta. Já os vínculos
              com colaboradores são decisão de gente, então uma conexão com pessoas vinculadas não é removida — para
              só parar de sincronizar, desmarque &ldquo;Ativa&rdquo; abaixo.
            </p>
          ) : null}

          {erro ? <Alert tone="danger">{erro}</Alert> : null}
          {sucesso ? <Alert tone="ok">{sucesso}</Alert> : null}
          {teste ? <ResultadoDoTeste resultado={teste} /> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="O que ler do diretório" description="Nada aqui altera dado operacional — só define o que entra no espelho." />
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {O_QUE_LER.map((campo) => (
            <Interruptor
              key={campo.chave}
              label={campo.label}
              descricao={campo.descricao}
              checked={Boolean(opcoes[campo.chave])}
              onChange={(valor) => ajustar(campo.chave, valor as never)}
            />
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Efeito sobre o cadastro"
          description="As duas únicas opções que alcançam colaboradores. Nascem desligadas."
        />
        <CardBody className="grid gap-3">
          {EFEITOS.map((campo) => (
            <Interruptor
              key={campo.chave}
              destaque
              label={campo.label}
              descricao={campo.descricao}
              checked={Boolean(opcoes[campo.chave])}
              onChange={(valor) => ajustar(campo.chave, valor as never)}
            />
          ))}

          {opcoes.autoCriarColaboradores ? (
            <Field
              label="Equipe de entrada"
              htmlFor="equipe"
              hint="Obrigatória: todo colaborador precisa de equipe, e o diretório não sabe qual é. Dá para remanejar depois."
            >
              <Select id="equipe" value={equipePadraoId} onChange={(e) => setEquipePadraoId(e.target.value)}>
                <option value="">Selecione uma equipe</option>
                {equipes.map((equipe) => (
                  <option key={equipe.id} value={equipe.id}>
                    {equipe.nome}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Execução" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Intervalo entre sincronizações" htmlFor="intervalo" hint="Em minutos, de 15 a 1440.">
            <Input
              id="intervalo"
              type="number"
              min={15}
              max={1440}
              value={opcoes.intervaloMinutos}
              onChange={(e) => ajustar('intervaloMinutos', Number(e.target.value))}
            />
          </Field>
          <Field label="Fuso horário padrão" htmlFor="fuso" hint="Usado quando a pessoa não tem fuso definido no diretório.">
            <Input id="fuso" value={opcoes.fusoHorarioPadrao} onChange={(e) => ajustar('fusoHorarioPadrao', e.target.value)} />
          </Field>
          <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
            <Interruptor
              label="Registrar cada objeto no log"
              descricao="Guarda o que mudou pessoa a pessoa. Útil para conferir; gera bastante linha."
              checked={opcoes.logOperacoes}
              onChange={(valor) => ajustar('logOperacoes', valor)}
            />
            <Interruptor
              label="Ativa"
              descricao="Conexão inativa não sincroniza, mas mantém tudo o que já foi lido."
              checked={ativo}
              onChange={setAtivo}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function ResultadoDoTeste({ resultado }: { resultado: ResultadoTeste }) {
  if (resultado.erro) {
    return (
      <Alert tone="danger">
        <span className="flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{resultado.erro}</span>
        </span>
      </Alert>
    );
  }

  return (
    <div className="rounded-lg border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-xs font-medium text-ink">
          {resultado.ok ? <Check size={14} className="text-ok" /> : <X size={14} className="text-danger" />}
          {resultado.ok ? 'Conexão funcionando' : 'Falta permissão obrigatória'}
        </span>
        {resultado.organizacao ? (
          <span className="text-2xs text-ink-muted">
            {resultado.organizacao.nome}
            {resultado.organizacao.dominios[0] ? ` · ${resultado.organizacao.dominios[0]}` : ''}
          </span>
        ) : null}
      </div>

      <ul className="divide-y divide-line">
        {resultado.verificacoes.map((item) => (
          <li key={item.permissao} className="flex items-start gap-2.5 px-3.5 py-2.5">
            {item.ok ? (
              <Check size={14} className="mt-0.5 shrink-0 text-ok" />
            ) : (
              <X size={14} className={`mt-0.5 shrink-0 ${item.obrigatoria ? 'text-danger' : 'text-ink-subtle'}`} />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink">
                {item.recurso}
                <code className="rounded bg-surface-hover px-1 py-0.5 text-2xs font-normal text-ink-muted">
                  {item.permissao}
                </code>
                {!item.obrigatoria ? <Badge tone="neutral">opcional</Badge> : null}
              </p>
              <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">{item.detalhe}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/// Botão de reteste da tela de resumo, quando não se está editando nada.
export function RetestButton({ conexaoId }: { conexaoId: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function retestar() {
    setPending(true);
    await fetch(`/api/diretorio/conexoes/${conexaoId}/testar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => undefined);
    setPending(false);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={retestar} disabled={pending}>
      <RefreshCw size={14} className={pending ? 'animate-spin' : undefined} />
      {pending ? 'Verificando...' : 'Verificar agora'}
    </Button>
  );
}
