'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Link2, Lock, ShieldCheck, UserPlus, Wand2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Select, cx } from '@/components/ui';

/**
 * Vincular pessoas do diretório a colaboradores.
 *
 * É a única tela do módulo que escreve no cadastro, e ela diz isso. Duas
 * decisões de desenho merecem nota:
 *
 * 1. **A sugestão por e-mail é pista, não vínculo.** O vínculo gravado é
 *    sempre pelo Object ID; o e-mail só ajuda um humano a reconhecer a pessoa
 *    uma vez. Endereço é reciclado, e vincular por ele automaticamente
 *    entregaria o histórico de alguém a outra pessoa.
 * 2. **Mostra o efeito antes de aplicar.** A prévia usa a mesma função de
 *    decisão que a gravação, então não há como ela mentir.
 */

type ColaboradorDisponivel = {
  id: number;
  nome: string;
  email: string;
  cargo: string;
  ativo: boolean;
  equipe: { id: number; nome: string } | null;
};

type Pendente = {
  id: number;
  externalId: string;
  nomeExibicao: string;
  email: string | null;
  cargo: string | null;
  contaHabilitada: boolean;
  sugestao: ColaboradorDisponivel | null;
};

type Pendencias = {
  pendentes: Pendente[];
  colaboradoresDisponiveis: ColaboradorDisponivel[];
  camposTravaveis: string[];
  nuncaTocados: string[];
};

type Mudanca = { campo: string; de: unknown; para: unknown };

const ROTULO_DE_CAMPO: Record<string, string> = {
  nome: 'Nome',
  email: 'E-mail',
  cargo: 'Cargo',
  telefone: 'Telefone',
  ativo: 'Situação',
};

function valor(v: unknown): string {
  if (v === true) return 'ativo';
  if (v === false) return 'inativo';
  if (v == null || v === '') return '(vazio)';
  return String(v);
}

function LinhaPendente({
  pessoa,
  colaboradores,
  equipes,
  aoConcluir,
}: {
  pessoa: Pendente;
  colaboradores: ColaboradorDisponivel[];
  equipes: Array<{ id: number; nome: string }>;
  aoConcluir: () => void;
}) {
  const [escolhido, setEscolhido] = useState<string>(pessoa.sugestao ? String(pessoa.sugestao.id) : '');
  const [equipe, setEquipe] = useState<string>(equipes[0] ? String(equipes[0].id) : '');
  const [previa, setPrevia] = useState<Mudanca[] | null>(null);
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function simular() {
    if (!escolhido) return;
    setPending(true);
    setErro(null);
    try {
      const response = await fetch(`/api/diretorio/pessoas/${pessoa.id}/previa?colaboradorId=${escolhido}`);
      const dados = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErro(dados.error || 'Não foi possível simular.');
        return;
      }
      setPrevia(dados.mudancas ?? []);
    } finally {
      setPending(false);
    }
  }

  async function executar(rota: string, corpo: unknown) {
    setPending(true);
    setErro(null);
    try {
      const response = await fetch(`/api/diretorio/pessoas/${pessoa.id}/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const dados = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErro(dados.error || 'Não foi possível concluir.');
        return;
      }
      aoConcluir();
    } catch {
      setErro('Falha de comunicação.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            {pessoa.nomeExibicao}
            {!pessoa.contaHabilitada ? <Badge tone="warn">desabilitada</Badge> : null}
          </p>
          <p className="truncate text-2xs text-ink-subtle">
            {pessoa.email ?? 'sem e-mail'} {pessoa.cargo ? `· ${pessoa.cargo}` : ''}
          </p>
        </div>
        {pessoa.sugestao ? (
          <span className="flex items-center gap-1 text-2xs text-accent">
            <Wand2 size={12} /> e-mail bate com &ldquo;{pessoa.sugestao.nome}&rdquo;
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Select
          value={escolhido}
          onChange={(e) => {
            setEscolhido(e.target.value);
            setPrevia(null);
          }}
          aria-label={`Colaborador para ${pessoa.nomeExibicao}`}
        >
          <option value="">Escolha o colaborador…</option>
          {colaboradores.map((colaborador) => (
            <option key={colaborador.id} value={colaborador.id}>
              {colaborador.nome} — {colaborador.email}
              {colaborador.ativo ? '' : ' (inativo)'}
            </option>
          ))}
        </Select>

        <Button variant="ghost" size="sm" onClick={simular} disabled={!escolhido || pending}>
          Simular
        </Button>
        <Button
          size="sm"
          onClick={() => executar('vincular', { colaboradorId: Number(escolhido) })}
          disabled={!escolhido || pending}
        >
          <Link2 size={14} /> Vincular
        </Button>
      </div>

      {previa ? (
        <div className="mt-2 rounded-md border border-line bg-surface-raised p-2.5">
          {previa.length === 0 ? (
            <p className="text-2xs text-ink-muted">Nada mudaria neste cadastro.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {previa.map((mudanca) => (
                <li key={mudanca.campo} className="flex flex-wrap items-center gap-1.5 text-2xs">
                  <span className="text-ink-muted">{ROTULO_DE_CAMPO[mudanca.campo] ?? mudanca.campo}:</span>
                  <span className="text-ink-subtle line-through">{valor(mudanca.de)}</span>
                  <ArrowRight size={10} className="text-ink-subtle" />
                  <span className="font-medium text-ink">{valor(mudanca.para)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-2">
        <span className="mr-auto text-2xs text-ink-subtle">Não é ninguém do cadastro ainda?</span>
        <Select value={equipe} onChange={(e) => setEquipe(e.target.value)} className="py-1 text-2xs" aria-label="Equipe do novo colaborador">
          {equipes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => executar('promover', { equipeId: Number(equipe) })}
          disabled={pending || !equipe || !pessoa.email}
          title={!pessoa.email ? 'Sem e-mail no diretório, o cadastro não pode ser criado' : undefined}
        >
          <UserPlus size={14} /> Criar colaborador
        </Button>
      </div>

      {erro ? (
        <div className="mt-2">
          <Alert tone="danger">{erro}</Alert>
        </div>
      ) : null}
    </div>
  );
}

export function LinkPanel({
  conexaoId,
  equipes,
  vinculadas,
}: {
  conexaoId: number;
  equipes: Array<{ id: number; nome: string }>;
  vinculadas: number;
}) {
  const router = useRouter();
  const [dados, setDados] = useState<Pendencias | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await fetch(`/api/diretorio/conexoes/${conexaoId}/pendencias`);
      if (!response.ok) return;
      setDados(await response.json());
    } finally {
      setCarregando(false);
    }
  }, [conexaoId]);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  const pendentes = dados?.pendentes ?? [];
  const comSugestao = pendentes.filter((pessoa) => pessoa.sugestao).length;

  return (
    <Card>
      <CardHeader
        title="Vínculo com o cadastro"
        description={
          aberto
            ? `${pendentes.length} pessoa(s) do diretório sem colaborador${comSugestao > 0 ? ` · ${comSugestao} com e-mail coincidente` : ''}`
            : `${vinculadas} pessoa(s) já vinculada(s). Abrir para associar o resto.`
        }
        action={
          <Button variant={aberto ? 'ghost' : 'secondary'} size="sm" onClick={() => setAberto((v) => !v)}>
            {aberto ? 'Fechar' : 'Abrir'}
          </Button>
        }
      />

      {aberto ? (
        <CardBody className="grid gap-3">
          <div className="rounded-lg border border-warn/30 bg-warn-soft p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-warn">
              <ShieldCheck size={14} className="shrink-0" />
              Esta é a única parte do módulo que escreve no cadastro
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-ink-muted">
              Depois de vincular, a sincronização passa a manter <strong>nome, e-mail e cargo</strong> em dia, e
              preenche <strong>telefone</strong> se estiver vazio. Nunca toca em equipe, contrato, plantão,
              admissão, desligamento, matrícula ou CPF. Para congelar um campo específico, use a trava{' '}
              <Lock size={10} className="inline" /> no colaborador vinculado.
            </p>
          </div>

          {carregando ? (
            <p className="px-1 text-xs text-ink-subtle">Carregando…</p>
          ) : pendentes.length === 0 ? (
            <EmptyState
              icon={<Link2 size={22} />}
              title="Nada pendente"
              description="Todas as pessoas do diretório já estão vinculadas, ou não há ninguém no espelho ainda."
            />
          ) : equipes.length === 0 ? (
            <Alert tone="warn">
              Não há equipes cadastradas. Crie ao menos uma antes de criar colaboradores a partir do diretório.
            </Alert>
          ) : (
            <div className={cx('flex max-h-[32rem] flex-col gap-2 overflow-y-auto')}>
              {pendentes.map((pessoa) => (
                <LinhaPendente
                  key={pessoa.id}
                  pessoa={pessoa}
                  colaboradores={dados?.colaboradoresDisponiveis ?? []}
                  equipes={equipes}
                  aoConcluir={() => {
                    void carregar();
                    router.refresh();
                  }}
                />
              ))}
            </div>
          )}
        </CardBody>
      ) : null}
    </Card>
  );
}
