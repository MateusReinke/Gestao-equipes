import { z } from 'zod';
import { Prisma, ShareAccess } from '@prisma/client';
import { JwtPayload } from '../types/auth';
import { dashboardRepository } from '../repositories/dashboard.repository';
import { teamRepository } from '../repositories/team.repository';
import { EMPTY_LAYOUT, layoutSchema, DashboardLayout } from '../types/widgets';
import { getVisibleTeamIds } from './scope.service';
import {
  getEffectiveAccess,
  getSharedAccessMap,
  permiteEditar,
  permiteGerir,
  resolvePublicToken,
  revokeAllForResource,
} from './share.service';
import { resolveWidgets, WidgetScope } from './widget-data.service';

export class NoActiveTenantError extends Error {}
export class DashboardNotFoundError extends Error {}
export class DashboardForbiddenError extends Error {}
export class DashboardVersionNotFoundError extends Error {}

export const dashboardCreateSchema = z.object({
  nome: z.string().trim().min(2, 'Dê um nome ao dashboard').max(80),
  descricao: z.string().trim().max(300).optional().nullable(),
  layout: layoutSchema.optional(),
});

export const dashboardUpdateSchema = z.object({
  nome: z.string().trim().min(2).max(80).optional(),
  descricao: z.string().trim().max(300).nullable().optional(),
});

export const dashboardLayoutSchema = z.object({
  layout: layoutSchema,
  nota: z.string().trim().max(200).optional().nullable(),
});

export type DashboardCreateInput = z.infer<typeof dashboardCreateSchema>;
export type DashboardUpdateInput = z.infer<typeof dashboardUpdateSchema>;
export type DashboardLayoutInput = z.infer<typeof dashboardLayoutSchema>;

function requireTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) throw new NoActiveTenantError('Selecione uma empresa ativa');
  return user.activeTenantId;
}

/// O layout é lido de volta do banco como Json solto; validar na leitura evita
/// que um registro antigo ou adulterado quebre o render.
function parseLayout(valor: Prisma.JsonValue | null | undefined): DashboardLayout {
  const parsed = layoutSchema.safeParse(valor);
  return parsed.success ? parsed.data : EMPTY_LAYOUT;
}

/**
 * Lista os dashboards que o usuário alcança, em três grupos:
 * os que ele criou, os compartilhados com ele e os favoritos.
 */
export async function listDashboards(user?: JwtPayload) {
  if (!user || user.activeTenantId == null) {
    return { meus: [], compartilhados: [], favoritosIds: [] as number[] };
  }

  const tenantId = user.activeTenantId;
  const [meus, acessos, favoritos] = await Promise.all([
    dashboardRepository.findOwnedBy(tenantId, user.userId),
    getSharedAccessMap(user, 'dashboard'),
    dashboardRepository.findFavoriteIds(user.userId),
  ]);

  const idsCompartilhados = [...acessos.keys()]
    .map((chave) => Number(chave.split(':')[1]))
    .filter((id) => Number.isFinite(id));

  const proprios = new Set(meus.map((item) => item.id));
  const compartilhados = (await dashboardRepository.findByIds(idsCompartilhados))
    .filter((item) => !proprios.has(item.id))
    .map((item) => ({
      ...item,
      acesso: acessos.get(`dashboard:${item.id}`) ?? ('leitura' as ShareAccess),
    }));

  return {
    meus,
    compartilhados,
    favoritosIds: favoritos.map((item) => item.dashboardId),
  };
}

/// Carrega o dashboard e o acesso do usuário a ele, ou explode com 403/404.
async function loadWithAccess(dashboardId: number, user: JwtPayload) {
  const dashboard = await dashboardRepository.findById(dashboardId);
  if (!dashboard) throw new DashboardNotFoundError('Dashboard não encontrado');

  const acesso = await getEffectiveAccess({
    user,
    recursoTipo: 'dashboard',
    recursoId: dashboard.id,
    ownerUserId: dashboard.ownerUserId,
    recursoTenantId: dashboard.tenantId,
  });

  if (!acesso) throw new DashboardNotFoundError('Dashboard não encontrado');
  return { dashboard, acesso };
}

/**
 * Escopo de leitura dos widgets.
 * Para quem está no mesmo tenant do dashboard, vale o recorte de equipes do
 * próprio usuário. Para um Administrador Global visitando de fora (ou um
 * compartilhamento de plataforma), vale o tenant dono do dashboard por inteiro
 * — só assim os widgets têm o que mostrar.
 */
async function scopeParaLeitura(dashboardTenantId: number, user: JwtPayload): Promise<WidgetScope> {
  if (user.activeTenantId === dashboardTenantId) {
    return { tenantId: dashboardTenantId, teamIds: await getVisibleTeamIds(user) };
  }

  const equipes = await teamRepository.findAllIds(dashboardTenantId);
  return { tenantId: dashboardTenantId, teamIds: equipes.map((item) => item.id) };
}

export async function getDashboard(dashboardId: number, user?: JwtPayload) {
  if (!user) throw new DashboardForbiddenError('Sessão inválida');
  const { dashboard, acesso } = await loadWithAccess(dashboardId, user);

  const layout = parseLayout(dashboard.versaoAtual?.layout ?? null);
  const scope = await scopeParaLeitura(dashboard.tenantId, user);
  const widgets = await resolveWidgets(layout.widgets, scope);

  const favoritos = await dashboardRepository.findFavoriteIds(user.userId);

  return {
    id: dashboard.id,
    nome: dashboard.nome,
    descricao: dashboard.descricao,
    tenantId: dashboard.tenantId,
    tenantNome: dashboard.tenant?.nome ?? null,
    owner: dashboard.owner,
    ehDono: dashboard.ownerUserId === user.userId,
    acesso,
    podeEditar: permiteEditar(acesso),
    podeGerir: permiteGerir(acesso),
    favorito: favoritos.some((item) => item.dashboardId === dashboard.id),
    versaoAtual: dashboard.versaoAtual
      ? { id: dashboard.versaoAtual.id, versao: dashboard.versaoAtual.versao, createdAt: dashboard.versaoAtual.createdAt }
      : null,
    layout,
    widgets,
  };
}

export async function createDashboard(data: DashboardCreateInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);
  return dashboardRepository.createWithFirstVersion({
    tenantId,
    nome: data.nome,
    descricao: data.descricao ?? null,
    ownerUserId: user!.userId,
    layout: (data.layout ?? EMPTY_LAYOUT) as unknown as Prisma.InputJsonValue,
  });
}

export async function updateDashboardMeta(dashboardId: number, data: DashboardUpdateInput, user?: JwtPayload) {
  if (!user) throw new DashboardForbiddenError('Sessão inválida');
  const { dashboard, acesso } = await loadWithAccess(dashboardId, user);
  if (!permiteEditar(acesso)) throw new DashboardForbiddenError('Você tem acesso apenas de leitura a este dashboard');

  const depois = await dashboardRepository.updateMeta(dashboardId, data);
  return { antes: dashboard, depois };
}

/// Salvar o layout publica uma nova versão — o conteúdo anterior nunca é sobrescrito.
export async function publishLayout(dashboardId: number, data: DashboardLayoutInput, user?: JwtPayload) {
  if (!user) throw new DashboardForbiddenError('Sessão inválida');
  const { dashboard, acesso } = await loadWithAccess(dashboardId, user);
  if (!permiteEditar(acesso)) throw new DashboardForbiddenError('Você tem acesso apenas de leitura a este dashboard');

  const antes = parseLayout(dashboard.versaoAtual?.layout ?? null);
  const depois = await dashboardRepository.publishVersion({
    dashboardId,
    layout: data.layout as unknown as Prisma.InputJsonValue,
    nota: data.nota ?? null,
    criadoPorId: user.userId,
  });

  return { antes, depois };
}

export async function listVersions(dashboardId: number, user?: JwtPayload) {
  if (!user) throw new DashboardForbiddenError('Sessão inválida');
  const { dashboard } = await loadWithAccess(dashboardId, user);
  const versoes = await dashboardRepository.findVersions(dashboard.id);
  return versoes.map((versao) => ({ ...versao, atual: versao.id === dashboard.versaoAtualId }));
}

/**
 * Restaurar não apaga nada: republica o layout da versão escolhida como uma
 * versão nova. O histórico continua linear e auditável.
 */
export async function restoreVersion(dashboardId: number, versionId: number, user?: JwtPayload) {
  if (!user) throw new DashboardForbiddenError('Sessão inválida');
  const { dashboard, acesso } = await loadWithAccess(dashboardId, user);
  if (!permiteEditar(acesso)) throw new DashboardForbiddenError('Você tem acesso apenas de leitura a este dashboard');

  const versao = await dashboardRepository.findVersion(dashboard.id, versionId);
  if (!versao) throw new DashboardVersionNotFoundError('Versão não encontrada');

  const depois = await dashboardRepository.publishVersion({
    dashboardId,
    layout: versao.layout as Prisma.InputJsonValue,
    nota: `Restaurado da versão ${versao.versao}`,
    criadoPorId: user.userId,
  });

  return { versaoRestaurada: versao.versao, depois };
}

export async function deleteDashboard(dashboardId: number, user?: JwtPayload) {
  if (!user) throw new DashboardForbiddenError('Sessão inválida');
  const { dashboard, acesso } = await loadWithAccess(dashboardId, user);
  // Apagar é decisão de dono: acesso de edição não basta.
  if (!permiteGerir(acesso)) throw new DashboardForbiddenError('Apenas quem administra o dashboard pode removê-lo');

  await revokeAllForResource('dashboard', dashboard.id, dashboard.tenantId);
  await dashboardRepository.remove(dashboard.id);
  return dashboard;
}

export async function toggleFavorite(dashboardId: number, favorito: boolean, user?: JwtPayload) {
  if (!user) throw new DashboardForbiddenError('Sessão inválida');
  // Passa pelo controle de acesso: não dá para favoritar o que não se enxerga.
  await loadWithAccess(dashboardId, user);

  if (favorito) await dashboardRepository.addFavorite(dashboardId, user.userId);
  else await dashboardRepository.removeFavorite(dashboardId, user.userId);

  return { dashboardId, favorito };
}

/// Garante que o usuário pode compartilhar este dashboard antes de criar a concessão.
export async function assertCanShare(dashboardId: number, user?: JwtPayload) {
  if (!user) throw new DashboardForbiddenError('Sessão inválida');
  const { dashboard, acesso } = await loadWithAccess(dashboardId, user);
  if (!permiteGerir(acesso)) throw new DashboardForbiddenError('Apenas quem administra o dashboard pode compartilhá-lo');
  return dashboard;
}

/**
 * Wallboard público: resolve o token do link e devolve o painel já renderizado,
 * sempre em modo leitura e com o escopo do tenant dono. Não exige sessão —
 * o segredo é o próprio token.
 */
export async function getPublicDashboard(token: string) {
  const concessao = await resolvePublicToken(token);
  if (!concessao || concessao.recursoTipo !== 'dashboard') return null;

  const dashboard = await dashboardRepository.findById(concessao.recursoId);
  if (!dashboard) return null;

  const layout = parseLayout(dashboard.versaoAtual?.layout ?? null);
  const equipes = await teamRepository.findAllIds(dashboard.tenantId);
  const widgets = await resolveWidgets(layout.widgets, {
    tenantId: dashboard.tenantId,
    teamIds: equipes.map((item) => item.id),
  });

  return {
    nome: dashboard.nome,
    descricao: dashboard.descricao,
    empresa: dashboard.tenant?.nome ?? null,
    atualizadoEm: new Date().toISOString(),
    widgets,
  };
}
