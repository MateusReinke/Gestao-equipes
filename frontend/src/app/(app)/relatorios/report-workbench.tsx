'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download, Search } from 'lucide-react';
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, Field, Select, Input, Table, Td, Th, Tr, cx } from '@/components/ui';
import { formatDate } from '@/lib/format';

export type ReportMeta = { id: string; nome: string; descricao: string };

type Coluna = { chave: string; titulo: string; numerico?: boolean; formato?: 'data' };
type Linha = Record<string, string | number | null>;
type Relatorio = { id: string; nome: string; colunas: Coluna[]; linhas: Linha[] };

/// Quantas linhas a prévia mostra. O CSV sempre leva tudo — a tela só evita
/// despejar milhares de <tr> no navegador.
const LIMITE_PREVIA = 100;

/// A API manda data em ISO (é o que vai para o CSV, sem ambiguidade de dia/mês).
/// Na tela, quem lê espera dd/mm/aaaa.
function celula(valor: string | number | null, coluna: Coluna) {
  if (valor === '' || valor == null) return '—';
  if (coluna.formato === 'data') return formatDate(String(valor));
  return String(valor);
}

export function ReportWorkbench({
  relatorios,
  periodoPadrao,
  equipes,
  podeExportar,
}: {
  relatorios: ReportMeta[];
  periodoPadrao: { inicio: string; fim: string };
  equipes: Array<{ id: number; nome: string }>;
  podeExportar: boolean;
}) {
  const [relatorioId, setRelatorioId] = useState(relatorios[0]?.id ?? '');
  const [inicio, setInicio] = useState(periodoPadrao.inicio);
  const [fim, setFim] = useState(periodoPadrao.fim);
  const [equipeId, setEquipeId] = useState('');
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryString = useCallback(() => {
    const params = new URLSearchParams({ inicio, fim });
    if (equipeId) params.set('equipeId', equipeId);
    return params.toString();
  }, [inicio, fim, equipeId]);

  const carregar = useCallback(async () => {
    if (!relatorioId || !inicio || !fim) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/relatorios/${relatorioId}?${queryString()}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || 'Não foi possível gerar o relatório');
        setDados(null);
        return;
      }
      setDados(payload as Relatorio);
    } catch {
      setError('Falha de comunicação com o servidor. Tente novamente em instantes.');
      setDados(null);
    } finally {
      setPending(false);
    }
  }, [relatorioId, inicio, fim, queryString]);

  // Carrega ao abrir e sempre que o relatório escolhido muda; mudanças de
  // período/equipe só valem quando a pessoa clica em "Gerar".
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatorioId]);

  const metaAtual = relatorios.find((item) => item.id === relatorioId);
  const linhasVisiveis = dados?.linhas.slice(0, LIMITE_PREVIA) ?? [];
  const ocultas = (dados?.linhas.length ?? 0) - linhasVisiveis.length;

  return (
    <>
      <Card>
        <CardHeader title="Filtros" description={metaAtual?.descricao} />
        <CardBody>
          <form
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              carregar();
            }}
          >
            <Field label="Relatório" htmlFor="relatorio" className="xl:col-span-2">
              <Select id="relatorio" value={relatorioId} onChange={(event) => setRelatorioId(event.target.value)}>
                {relatorios.map((relatorio) => (
                  <option key={relatorio.id} value={relatorio.id}>
                    {relatorio.nome}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="De" htmlFor="inicio">
              <Input id="inicio" type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} required />
            </Field>

            <Field label="Até" htmlFor="fim">
              <Input id="fim" type="date" value={fim} onChange={(event) => setFim(event.target.value)} required />
            </Field>

            <Field label="Equipe" htmlFor="equipe" hint="Vazio = todas que você enxerga">
              <Select id="equipe" value={equipeId} onChange={(event) => setEquipeId(event.target.value)}>
                <option value="">Todas as equipes</option>
                {equipes.map((equipe) => (
                  <option key={equipe.id} value={equipe.id}>
                    {equipe.nome}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-5">
              <Button type="submit" variant="primary" disabled={pending}>
                <Search size={15} /> {pending ? 'Gerando...' : 'Gerar'}
              </Button>
              {podeExportar ? (
                <a
                  href={`/api/relatorios/${relatorioId}/csv?${queryString()}`}
                  download
                  className={cx(
                    'inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface-raised px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover',
                    (!dados || dados.linhas.length === 0) && 'pointer-events-none opacity-55'
                  )}
                >
                  <Download size={15} /> Exportar CSV
                </a>
              ) : null}
              {dados ? (
                <span className="text-xs text-ink-subtle">
                  {dados.linhas.length} linha{dados.linhas.length === 1 ? '' : 's'}
                  {ocultas > 0 ? ` · mostrando as ${LIMITE_PREVIA} primeiras` : ''}
                </span>
              ) : null}
            </div>

            {error ? (
              <div className="sm:col-span-2 xl:col-span-5">
                <Alert tone="danger">{error}</Alert>
              </div>
            ) : null}
          </form>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title={dados?.nome ?? 'Prévia'}
          description={
            dados && dados.linhas.length > 0
              ? `Período de ${inicio.split('-').reverse().join('/')} a ${fim.split('-').reverse().join('/')}`
              : undefined
          }
        />
        {!dados || dados.linhas.length === 0 ? (
          <EmptyState
            icon={<BarChart3 size={24} />}
            title={pending ? 'Gerando relatório...' : 'Nenhum registro no período'}
            description={
              pending ? undefined : 'Ajuste o período ou a equipe e gere de novo. O CSV sai com exatamente o que aparece aqui.'
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                {dados.colunas.map((coluna) => (
                  <Th key={coluna.chave} className={coluna.numerico ? 'text-right' : undefined}>
                    {coluna.titulo}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhasVisiveis.map((linha, index) => (
                <Tr key={index}>
                  {dados.colunas.map((coluna) => (
                    <Td
                      key={coluna.chave}
                      className={coluna.numerico || coluna.formato === 'data' ? 'tabular whitespace-nowrap' : undefined}
                    >
                      <span className={coluna.numerico ? 'block text-right' : undefined}>
                        {celula(linha[coluna.chave], coluna)}
                      </span>
                    </Td>
                  ))}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
