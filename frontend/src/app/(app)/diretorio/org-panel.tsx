'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, GitBranch, Lightbulb, Link2, Users2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, cx } from '@/components/ui';

/**
 * Organograma, grupos e sugestões de responsável.
 *
 * Tudo em leitura. A sugestão de responsável merece atenção especial: ela é
 * uma pista, e a tela diz isso — `manager` do Entra é hierarquia de RH,
 * `gestor_equipes` é quem responde pela operação. Aplicar um no outro daria
 * visibilidade e notificações a quem não deveria tê-las.
 */

type No = {
  id: number;
  externalId: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  contaHabilitada: boolean;
  vinculada: boolean;
  totalAbaixo: number;
  subordinados: No[];
};

type Organograma = {
  raizes: No[];
  resumo: { pessoas: number; semGestor: number; orfaos: number; ciclos: number };
};

type Grupo = {
  id: number;
  nome: string;
  descricao: string | null;
  tipo: string | null;
  membros: number;
  removidoEm: string | null;
};

type Sugestao = {
  equipe: { id: number; nome: string };
  gestor: { externalId: string; nome: string; cargo: string | null; colaboradorId: number | null };
  pessoasQueReportam: number;
};

function Ramo({ no, nivel }: { no: No; nivel: number }) {
  // Abre os dois primeiros níveis: mais que isso vira parede de texto, menos
  // esconde a estrutura que a pessoa veio ver.
  const [aberto, setAberto] = useState(nivel < 2);
  const temFilhos = no.subordinados.length > 0;

  return (
    <li>
      <div className="flex items-center gap-1.5 py-1">
        {temFilhos ? (
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-label={aberto ? `Recolher ${no.nome}` : `Expandir ${no.nome}`}
            className="rounded p-0.5 text-ink-subtle hover:bg-surface-hover hover:text-ink"
          >
            <ChevronRight size={13} className={cx('transition-transform', aberto && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-[18px]" aria-hidden />
        )}

        <span className={cx('truncate text-xs', no.contaHabilitada ? 'text-ink' : 'text-ink-subtle')}>{no.nome}</span>
        {no.cargo ? <span className="hidden truncate text-2xs text-ink-subtle sm:inline">· {no.cargo}</span> : null}
        {no.vinculada ? <Badge tone="accent">vinculada</Badge> : null}
        {!no.contaHabilitada ? <Badge tone="warn">desabilitada</Badge> : null}
        {temFilhos ? (
          <span className="tabular ml-auto shrink-0 text-2xs text-ink-subtle">{no.totalAbaixo}</span>
        ) : null}
      </div>

      {temFilhos && aberto ? (
        <ul className="ml-3 border-l border-line pl-2">
          {no.subordinados.map((filho) => (
            <Ramo key={filho.externalId} no={filho} nivel={nivel + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OrgPanel({ conexaoId }: { conexaoId: number }) {
  const [aberto, setAberto] = useState(false);
  const [org, setOrg] = useState<Organograma | null>(null);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [o, g, s] = await Promise.all([
        fetch(`/api/diretorio/conexoes/${conexaoId}/organograma`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/diretorio/conexoes/${conexaoId}/grupos`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/diretorio/conexoes/${conexaoId}/sugestoes-responsavel`).then((r) => (r.ok ? r.json() : [])),
      ]);
      setOrg(o);
      setGrupos(Array.isArray(g) ? g : []);
      setSugestoes(Array.isArray(s) ? s : []);
    } finally {
      setCarregando(false);
    }
  }, [conexaoId]);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  const resumo = org?.resumo;

  return (
    <Card>
      <CardHeader
        title="Organograma e grupos"
        description={
          aberto && resumo
            ? `${resumo.pessoas} pessoa(s) · ${org!.raizes.length} no topo · ${grupos.length} grupo(s)`
            : 'Hierarquia do diretório, grupos e sugestões de responsável por equipe.'
        }
        action={
          <Button variant={aberto ? 'ghost' : 'secondary'} size="sm" onClick={() => setAberto((v) => !v)}>
            {aberto ? 'Fechar' : 'Abrir'}
          </Button>
        }
      />

      {aberto ? (
        <CardBody className="grid gap-4">
          {carregando ? <p className="text-xs text-ink-subtle">Carregando…</p> : null}

          {sugestoes.length > 0 ? (
            <div className="rounded-lg border border-accent/30 bg-accent-soft p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-accent">
                <Lightbulb size={14} className="shrink-0" />
                Sugestões de responsável por equipe
              </p>
              <p className="mt-1 text-2xs leading-relaxed text-ink-muted">
                Derivadas de a quem as pessoas da equipe reportam no diretório. São <strong>pistas</strong>: no Entra,
                gestor é hierarquia de RH; aqui, responsável por equipe é quem enxerga a escala e recebe os alertas.
                Podem não ser a mesma pessoa — confirme em <strong>Equipes &gt; Responsáveis</strong>.
              </p>

              <ul className="mt-2 flex flex-col gap-1">
                {sugestoes.map((sugestao) => (
                  <li
                    key={sugestao.equipe.id}
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-surface/50 px-2.5 py-1.5 text-2xs"
                  >
                    <span className="font-medium text-ink">{sugestao.equipe.nome}</span>
                    <ChevronRight size={11} className="text-ink-subtle" />
                    <span className="text-ink">{sugestao.gestor.nome}</span>
                    <span className="text-ink-subtle">
                      ({sugestao.pessoasQueReportam} da equipe reportam a ele)
                    </span>
                    {sugestao.gestor.colaboradorId == null ? (
                      <span className="ml-auto flex items-center gap-1 text-warn">
                        <Link2 size={10} /> sem colaborador vinculado
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {resumo && (resumo.orfaos > 0 || resumo.ciclos > 0) ? (
            <Alert tone="warn">
              {resumo.orfaos > 0 ? `${resumo.orfaos} pessoa(s) apontam para um gestor que não está no espelho. ` : ''}
              {resumo.ciclos > 0 ? `${resumo.ciclos} referência(s) circular(es) de chefia foram ignoradas. ` : ''}
              Elas aparecem no topo da árvore para não sumirem.
            </Alert>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="eyebrow mb-2 flex items-center gap-1.5">
                <GitBranch size={12} /> Hierarquia
              </p>
              {!org || org.raizes.length === 0 ? (
                <EmptyState
                  icon={<GitBranch size={20} />}
                  title="Sem hierarquia"
                  description="Ligue “Hierarquia de gestores” nas opções e sincronize."
                />
              ) : (
                <ul className="max-h-96 overflow-y-auto rounded-lg border border-line p-2">
                  {org.raizes.map((raiz) => (
                    <Ramo key={raiz.externalId} no={raiz} nivel={0} />
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="eyebrow mb-2 flex items-center gap-1.5">
                <Users2 size={12} /> Grupos do diretório
              </p>
              {grupos.length === 0 ? (
                <EmptyState
                  icon={<Users2 size={20} />}
                  title="Sem grupos"
                  description="Ligue “Grupos” nas opções e sincronize. Grupo do diretório não vira equipe operacional."
                />
              ) : (
                <ul className="max-h-96 overflow-y-auto rounded-lg border border-line p-2">
                  {grupos.map((grupo) => (
                    <li key={grupo.id} className="flex items-center gap-2 px-1 py-1.5">
                      <span className={cx('min-w-0 truncate text-xs', grupo.removidoEm ? 'text-ink-subtle line-through' : 'text-ink')}>
                        {grupo.nome}
                      </span>
                      {grupo.tipo ? <Badge tone="neutral">{grupo.tipo}</Badge> : null}
                      <span className="tabular ml-auto shrink-0 text-2xs text-ink-subtle">{grupo.membros}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardBody>
      ) : null}
    </Card>
  );
}
