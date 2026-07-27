import { AlertTriangle, Check, Network, PowerOff, X } from 'lucide-react';
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { fetchApiSafe } from '@/lib/api';
import { requirePermissionSession } from '@/lib/session';
import { PERMISSIONS, can } from '@/lib/session-types';
import { ConnectionForm, RetestButton } from './connection-form';
import type { Conexao, Equipe } from './types';

/**
 * Configuração da sincronização organizacional.
 *
 * O módulo é lido, não escrito, do ponto de vista da operação: nada nesta
 * tela cria colaborador, mexe em escala ou altera férias. O que se configura
 * aqui é de onde vêm os dados do diretório e o que fazer com eles depois.
 */

function quando(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const PASSOS = [
  {
    titulo: 'Registre a aplicação',
    detalhe: 'No portal do Entra, em App registrations > New registration. Não precisa de Redirect URI: a leitura do diretório usa credenciais de aplicação, sem usuário no meio.',
  },
  {
    titulo: 'Conceda as permissões de aplicação',
    detalhe: 'Em API permissions > Microsoft Graph > Application permissions, adicione User.Read.All (obrigatória), Organization.Read.All e, se for sincronizar grupos, Group.Read.All e GroupMember.Read.All.',
  },
  {
    titulo: 'Clique em "Grant admin consent"',
    detalhe: 'Sem esse passo as permissões aparecem listadas mas não valem — é a causa mais comum de "sem permissão" no teste abaixo.',
  },
  {
    titulo: 'Gere um client secret',
    detalhe: 'Em Certificates & secrets > New client secret. Copie o campo Value na hora: ele só aparece uma vez. Anote a data de expiração.',
  },
];

export default async function DiretorioPage() {
  const session = await requirePermissionSession(PERMISSIONS.DIRECTORY_VIEW);
  const podeConfigurar = can(session.permissoes, PERMISSIONS.DIRECTORY_MANAGE);

  const conexoesResult = await fetchApiSafe<Conexao[]>('/api/diretorio/conexoes', []);

  // 503 aqui não é falha: é o módulo desligado neste ambiente, e a tela
  // precisa dizer isso em vez de mostrar um erro vermelho sem saída.
  if (conexoesResult.status === 503) {
    return (
      <>
        <PageHeader
          title="Diretório"
          description="Sincronização organizacional com o provedor de identidade da empresa."
        />
        <Card>
          <CardBody>
            <EmptyState
              icon={<PowerOff size={24} />}
              title="Módulo desligado neste ambiente"
              description={conexoesResult.error ?? undefined}
            />
          </CardBody>
        </Card>
      </>
    );
  }

  const conexao = conexoesResult.data[0] ?? null;
  const equipesResult = podeConfigurar
    ? await fetchApiSafe<Equipe[]>('/api/equipes', [])
    : { data: [] as Equipe[], error: null, status: 200 };

  return (
    <>
      <PageHeader
        title="Diretório"
        description="Traz pessoas, departamentos e cargos do Microsoft Entra ID. Os dados do diretório ficam separados dos dados operacionais — escalas, turnos, férias e plantões continuam sendo desta aplicação."
        action={conexao ? <RetestButton conexaoId={conexao.id} /> : null}
      />

      {conexoesResult.error ? <Alert tone="danger">{conexoesResult.error}</Alert> : null}

      {conexao ? (
        <Card className="mb-4">
          <CardHeader
            title={conexao.nome}
            description={
              conexao.ultimaSincronizacaoEm
                ? `Última sincronização em ${quando(conexao.ultimaSincronizacaoEm)}`
                : 'Nenhuma sincronização executada ainda.'
            }
            action={<Badge tone={conexao.ativo ? 'ok' : 'neutral'}>{conexao.ativo ? 'Ativa' : 'Inativa'}</Badge>}
          />
          <CardBody className="grid gap-3">
            {conexao.ultimoTesteEm ? (
              <p className="flex items-start gap-2 text-xs text-ink-muted">
                {conexao.ultimoTesteOk ? (
                  <Check size={14} className="mt-0.5 shrink-0 text-ok" />
                ) : (
                  <X size={14} className="mt-0.5 shrink-0 text-danger" />
                )}
                <span>
                  {conexao.ultimoTesteOk ? 'Verificada' : 'Com problema'} em {quando(conexao.ultimoTesteEm)}
                  {conexao.ultimoErro ? ` — ${conexao.ultimoErro}` : ''}
                </span>
              </p>
            ) : (
              <p className="flex items-start gap-2 text-xs text-ink-muted">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
                Conexão nunca verificada. Use &ldquo;Verificar agora&rdquo; para conferir credenciais e permissões.
              </p>
            )}
          </CardBody>
        </Card>
      ) : null}

      {podeConfigurar ? (
        <ConnectionForm conexao={conexao} equipes={equipesResult.data} />
      ) : conexao ? (
        <Card>
          <CardBody>
            <p className="text-sm text-ink-muted">
              Você pode acompanhar o diretório, mas alterar credenciais exige a permissão de administração da
              empresa.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Network size={24} />}
              title="Nenhuma conexão configurada"
              description="Um administrador da empresa precisa cadastrar a App Registration do Entra ID."
            />
          </CardBody>
        </Card>
      )}

      {podeConfigurar ? (
        <Card className="mt-4">
          <CardHeader
            title="Como preparar o Entra ID"
            description="Quatro passos no portal, feitos uma vez por empresa."
          />
          <CardBody>
            <ol className="grid gap-3">
              {PASSOS.map((passo, indice) => (
                <li key={passo.titulo} className="flex gap-3">
                  <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-2xs font-semibold text-ink-muted">
                    {indice + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink">{passo.titulo}</p>
                    <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">{passo.detalhe}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
