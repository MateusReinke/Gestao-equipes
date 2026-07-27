'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CircleSlash, Clock, Download, RefreshCw, RotateCcw, Search, UserX } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  Select,
  Table,
  Td,
  Th,
  Tr,
  cx,
} from '@/components/ui';
import type { Execucao, ItemDeCatalogo, PessoaDoEspelho, ResumoDoDiretorio } from './types';

/**
 * O espelho do diretório, em leitura.
 *
 * O ponto desta tela é permitir conferir o que veio do Entra **antes** de
 * autorizar qualquer efeito sobre o cadastro. Nada aqui cria colaborador,
 * mexe em escala ou altera férias — e a tela diz isso, porque quem abre uma
 * lista de 1.200 pessoas dentro de um sistema de escalas razoavelmente supõe
 * o contrário.
 */

function quando(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function duracao(inicio: string, fim: string | null) {
  if (!fim) return 'em andamento';
  const segundos = Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 1000);
  if (segundos < 60) return `${segundos}s`;
  return `${Math.floor(segundos / 60)}min ${segundos % 60}s`;
}

const TOM_DA_EXECUCAO = {
  sucesso: 'ok',
  parcial: 'warn',
  erro: 'danger',
  executando: 'info',
} as const;

function Contador({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: 'warn' | 'danger' }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2.5">
      <p
        className={cx(
          'tabular text-xl font-semibold',
          tom === 'danger' ? 'text-danger' : tom === 'warn' ? 'text-warn' : 'text-ink'
        )}
      >
        {valor.toLocaleString('pt-BR')}
      </p>
      <p className="mt-0.5 text-2xs leading-tight text-ink-muted">{rotulo}</p>
    </div>
  );
}

function Catalogo({ titulo, itens, icone }: { titulo: string; itens: ItemDeCatalogo[]; icone: React.ReactNode }) {
  const inativos = itens.filter((item) => !item.ativo).length;

  return (
    <Card>
      <CardHeader
        title={titulo}
        description={
          itens.length === 0
            ? 'Nada ainda — sincronize para montar o catálogo.'
            : `${itens.length - inativos} em uso${inativos > 0 ? ` · ${inativos} sem ninguém` : ''}`
        }
      />
      <CardBody>
        {itens.length === 0 ? (
          <EmptyState icon={icone} title="Catálogo vazio" />
        ) : (
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {itens.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-surface-hover"
              >
                <span className={cx('min-w-0 truncate text-xs', item.ativo ? 'text-ink' : 'text-ink-subtle line-through')}>
                  {item.nome}
                </span>
                <span className="tabular shrink-0 text-2xs text-ink-subtle">{item.pessoas}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/// Quando o agendador deve rodar de novo. Espelha `proximaExecucao` do backend
/// — é informativo, e mostrar "daqui a pouco" é melhor que não mostrar nada.
function proximaEm(ultima: string | null, intervaloMinutos: number): string {
  if (!ultima) return 'na próxima batida do agendador';

  const alvo = new Date(ultima).getTime() + intervaloMinutos * 60_000;
  const minutos = Math.round((alvo - Date.now()) / 60_000);

  if (minutos <= 0) return 'a qualquer momento';
  if (minutos < 60) return `em ~${minutos} min`;
  return `em ~${Math.round(minutos / 60)}h`;
}

export function MirrorPanel({
  conexaoId,
  resumo,
  podeSincronizar,
  conexaoAtiva,
  intervaloMinutos,
  ultimaSincronizacaoEm,
}: {
  conexaoId: number;
  resumo: ResumoDoDiretorio;
  podeSincronizar: boolean;
  conexaoAtiva: boolean;
  intervaloMinutos: number;
  ultimaSincronizacaoEm: string | null;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [incluirRemovidos, setIncluirRemovidos] = useState(false);
  const [pessoas, setPessoas] = useState<PessoaDoEspelho[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (busca.trim()) params.set('busca', busca.trim());
      if (departamento) params.set('departamento', departamento);
      if (incluirRemovidos) params.set('incluirRemovidos', 'true');

      const response = await fetch(`/api/diretorio/conexoes/${conexaoId}/pessoas?${params}`);
      if (!response.ok) return;

      const dados = await response.json();
      setPessoas(dados.pessoas ?? []);
      setTotal(dados.total ?? 0);
    } catch {
      // A lista é acessória: o resumo acima já contou o que importa.
    } finally {
      setCarregando(false);
    }
  }, [conexaoId, busca, departamento, incluirRemovidos]);

  // Espera a digitação parar antes de consultar — sem isso, cada tecla numa
  // busca por nome vira uma consulta ao banco.
  useEffect(() => {
    const timer = setTimeout(carregar, busca ? 350 : 0);
    return () => clearTimeout(timer);
  }, [carregar, busca]);

  async function sincronizar(completa = false) {
    setSincronizando(true);
    setErro(null);
    try {
      const response = await fetch(
        `/api/diretorio/conexoes/${conexaoId}/sincronizar${completa ? '?completa=true' : ''}`,
        { method: 'POST' }
      );
      const dados = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErro(dados.error || 'Não foi possível sincronizar.');
        return;
      }

      await carregar();
      router.refresh();
    } catch {
      setErro('Falha de comunicação ao sincronizar.');
    } finally {
      setSincronizando(false);
    }
  }

  const { contadores, departamentos, cargos, execucoes } = resumo;
  const ultima = execucoes[0] as Execucao | undefined;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader
          title="O que veio do diretório"
          description="Réplica somente leitura. Nada aqui virou colaborador, escala ou turno."
          action={
            podeSincronizar ? (
              <>
                {/* Releitura do zero: a saída de quem desconfia do que está no
                    espelho. O botão normal usa o cursor e é muito mais barato. */}
                <Button variant="ghost" size="sm" onClick={() => sincronizar(true)} disabled={sincronizando}>
                  <RotateCcw size={14} /> Recarregar tudo
                </Button>
                <Button size="sm" onClick={() => sincronizar(false)} disabled={sincronizando}>
                  <Download size={14} className={sincronizando ? 'animate-pulse' : undefined} />
                  {sincronizando ? 'Sincronizando...' : 'Sincronizar agora'}
                </Button>
              </>
            ) : null
          }
        />
        <CardBody className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Contador rotulo="pessoas no espelho" valor={contadores.presentes} />
            <Contador rotulo="contas desabilitadas" valor={contadores.desabilitadas} tom="warn" />
            <Contador rotulo="saíram do diretório" valor={contadores.removidas} tom="danger" />
            <Contador rotulo="vinculadas a colaborador" valor={contadores.vinculadas} />
          </div>

          {contadores.presentes === 0 ? (
            <p className="text-xs text-ink-muted">
              Nenhuma carga executada ainda. {podeSincronizar ? 'Use “Sincronizar agora” para trazer as pessoas.' : ''}
            </p>
          ) : (
            <p className="text-2xs leading-relaxed text-ink-subtle">
              &ldquo;Saíram do diretório&rdquo; são pessoas que não vieram na última leitura completa. Elas continuam aqui
              de propósito: apagá-las levaria junto o nome de quem aparece no histórico de escalas.
            </p>
          )}

          {erro ? <Alert tone="danger">{erro}</Alert> : null}
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Catalogo titulo="Departamentos" itens={departamentos} icone={<Building2 size={22} />} />
        <Catalogo titulo="Cargos" itens={cargos} icone={<CircleSlash size={22} />} />
      </div>

      <Card>
        <CardHeader title="Pessoas" description={`${total.toLocaleString('pt-BR')} no filtro atual`} />
        <CardBody className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome, e-mail ou cargo"
                className="pl-8"
                aria-label="Buscar pessoa no diretório"
              />
            </div>
            <Select
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
              aria-label="Filtrar por departamento"
            >
              <option value="">Todos os departamentos</option>
              {departamentos
                .filter((item) => item.ativo)
                .map((item) => (
                  <option key={item.id} value={item.nome}>
                    {item.nome}
                  </option>
                ))}
            </Select>
            <label className="flex items-center gap-2 whitespace-nowrap px-1 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={incluirRemovidos}
                onChange={(e) => setIncluirRemovidos(e.target.checked)}
                className="h-4 w-4 rounded border-line accent-accent"
              />
              Incluir quem saiu
            </label>
          </div>

          {pessoas.length === 0 ? (
            <EmptyState
              icon={<UserX size={22} />}
              title={carregando ? 'Carregando...' : 'Nenhuma pessoa encontrada'}
              description={total === 0 && !busca ? 'Sincronize para trazer o diretório.' : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <Tr>
                    <Th>Pessoa</Th>
                    <Th>Cargo</Th>
                    <Th>Departamento</Th>
                    <Th>Situação</Th>
                  </Tr>
                </thead>
                <tbody>
                  {pessoas.map((pessoa) => (
                    <Tr key={pessoa.id}>
                      <Td>
                        <span className="block truncate text-ink">{pessoa.nomeExibicao}</span>
                        <span className="block truncate text-2xs text-ink-subtle">{pessoa.email ?? '—'}</span>
                      </Td>
                      <Td className="text-ink-muted">{pessoa.cargo ?? '—'}</Td>
                      <Td className="text-ink-muted">{pessoa.departamento ?? '—'}</Td>
                      <Td>
                        <span className="flex flex-wrap gap-1">
                          {pessoa.removidoEm ? (
                            <Badge tone="danger">saiu do diretório</Badge>
                          ) : pessoa.contaHabilitada ? (
                            <Badge tone="ok">ativa</Badge>
                          ) : (
                            <Badge tone="warn">desabilitada</Badge>
                          )}
                          {pessoa.colaboradorId ? <Badge tone="accent">vinculada</Badge> : null}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              {total > pessoas.length ? (
                <p className="mt-2 text-2xs text-ink-subtle">
                  Mostrando {pessoas.length} de {total.toLocaleString('pt-BR')}. Refine a busca para ver o resto.
                </p>
              ) : null}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Execuções"
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span>{ultima ? `Última em ${quando(ultima.iniciadoEm)}` : 'Nenhuma execução registrada.'}</span>
              <span className="flex items-center gap-1">
                <Clock size={11} className="shrink-0" />
                {conexaoAtiva
                  ? `Agendador roda ${proximaEm(ultimaSincronizacaoEm, intervaloMinutos)}`
                  : 'Conexão inativa — o agendador não a sincroniza'}
              </span>
            </span>
          }
          action={
            <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
              <RefreshCw size={14} /> Atualizar
            </Button>
          }
        />
        <CardBody>
          {execucoes.length === 0 ? (
            <EmptyState icon={<Download size={22} />} title="Nenhuma sincronização executada" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <Tr>
                    <Th>Quando</Th>
                    <Th>Resultado</Th>
                    <Th className="text-right">Lidas</Th>
                    <Th className="text-right">Novas</Th>
                    <Th className="text-right">Saíram</Th>
                    <Th>Disparada por</Th>
                  </Tr>
                </thead>
                <tbody>
                  {execucoes.map((execucao) => (
                    <Tr key={execucao.id}>
                      <Td>
                        <span className="block text-ink">{quando(execucao.iniciadoEm)}</span>
                        <span className="block text-2xs text-ink-subtle">
                          {duracao(execucao.iniciadoEm, execucao.finalizadoEm)} · {execucao.modo}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={TOM_DA_EXECUCAO[execucao.status]}>{execucao.status}</Badge>
                        {execucao.detalhes?.recomecouDoZero ? (
                          // Explica por que uma execução que era para ser
                          // incremental aparece como completa.
                          <span className="mt-1 block text-2xs text-ink-subtle">cursor expirou, releu tudo</span>
                        ) : null}
                        {execucao.erro ? (
                          <span className="mt-1 block max-w-xs text-2xs text-danger">{execucao.erro}</span>
                        ) : null}
                        {execucao.conflitos > 0 ? (
                          <span className="mt-1 block text-2xs text-warn">{execucao.conflitos} conflito(s)</span>
                        ) : null}
                      </Td>
                      <Td className="tabular text-right text-ink-muted">{execucao.objetosLidos}</Td>
                      <Td className="tabular text-right text-ink-muted">{execucao.objetosCriados}</Td>
                      <Td className="tabular text-right text-ink-muted">{execucao.objetosRemovidos}</Td>
                      <Td className="text-2xs text-ink-subtle">{execucao.disparadoPor?.nome ?? 'agendador'}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
