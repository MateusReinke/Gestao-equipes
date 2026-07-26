import { Request, Response } from 'express';
import { ShareResourceType } from '@prisma/client';
import {
  listDashboards,
  getDashboard,
  createDashboard,
  updateDashboardMeta,
  publishLayout,
  listVersions,
  restoreVersion,
  deleteDashboard,
  toggleFavorite,
  assertCanShare,
  getPublicDashboard,
  dashboardCreateSchema,
  dashboardUpdateSchema,
  dashboardLayoutSchema,
  NoActiveTenantError,
  DashboardNotFoundError,
  DashboardForbiddenError,
  DashboardVersionNotFoundError,
} from '../services/custom-dashboard.service';
import {
  shareResource,
  revokeShare,
  listResourceShares,
  listTenantShares,
  shareSchema,
  ShareTargetInvalidError,
  ShareNotFoundError,
  ShareScopeNotAllowedError,
  NoActiveTenantError as ShareNoTenantError,
} from '../services/share.service';
import { WIDGET_CATALOG, METRIC_KEYS } from '../types/widgets';
import { auditFromRequest } from '../services/audit.service';

function handleError(error: unknown, res: Response) {
  if (error instanceof NoActiveTenantError || error instanceof ShareNoTenantError) {
    return res.status(409).json({ error: error.message });
  }
  if (error instanceof DashboardNotFoundError || error instanceof ShareNotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof DashboardVersionNotFoundError) return res.status(404).json({ error: error.message });
  if (error instanceof DashboardForbiddenError || error instanceof ShareScopeNotAllowedError) {
    return res.status(403).json({ error: error.message });
  }
  if (error instanceof ShareTargetInvalidError) return res.status(400).json({ error: error.message });
  throw error;
}

export const dashboardBuilderController = {
  /// Catálogo de widgets — o frontend monta o seletor a partir daqui.
  catalog(_req: Request, res: Response) {
    return res.json({ widgets: WIDGET_CATALOG, metricas: METRIC_KEYS });
  },

  async list(req: Request, res: Response) {
    try {
      return res.json(await listDashboards(req.user));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async show(req: Request, res: Response) {
    try {
      return res.json(await getDashboard(Number(req.params.id), req.user));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async create(req: Request, res: Response) {
    const parsed = dashboardCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const dashboard = await createDashboard(parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'create',
        entidade: 'dashboard',
        entidadeId: dashboard.id,
        descricao: `Criou o dashboard "${dashboard.nome}"`,
        depois: dashboard,
      });
      return res.status(201).json(dashboard);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async update(req: Request, res: Response) {
    const parsed = dashboardUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const { antes, depois } = await updateDashboardMeta(Number(req.params.id), parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'dashboard',
        entidadeId: req.params.id,
        descricao: `Editou o dashboard "${depois.nome}"`,
        antes,
        depois,
      });
      return res.json(depois);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async saveLayout(req: Request, res: Response) {
    const parsed = dashboardLayoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Layout inválido', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const { antes, depois } = await publishLayout(Number(req.params.id), parsed.data, req.user);
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'dashboard',
        entidadeId: req.params.id,
        descricao: `Publicou a versão ${depois.versaoAtual?.versao} do dashboard "${depois.nome}"`,
        antes,
        depois: parsed.data.layout,
      });
      return res.json(depois);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async versions(req: Request, res: Response) {
    try {
      return res.json(await listVersions(Number(req.params.id), req.user));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async restore(req: Request, res: Response) {
    try {
      const resultado = await restoreVersion(Number(req.params.id), Number(req.params.versionId), req.user);
      await auditFromRequest(req, {
        acao: 'update',
        entidade: 'dashboard',
        entidadeId: req.params.id,
        descricao: `Restaurou a versão ${resultado.versaoRestaurada} do dashboard "${resultado.depois.nome}"`,
        depois: { versaoRestaurada: resultado.versaoRestaurada },
      });
      return res.json(resultado.depois);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const dashboard = await deleteDashboard(Number(req.params.id), req.user);
      await auditFromRequest(req, {
        acao: 'delete',
        entidade: 'dashboard',
        entidadeId: req.params.id,
        descricao: `Removeu o dashboard "${dashboard.nome}"`,
        antes: dashboard,
      });
      return res.status(204).send();
    } catch (error) {
      return handleError(error, res);
    }
  },

  async favorite(req: Request, res: Response) {
    try {
      const favorito = req.method !== 'DELETE';
      return res.json(await toggleFavorite(Number(req.params.id), favorito, req.user));
    } catch (error) {
      return handleError(error, res);
    }
  },

  // ---------- Compartilhamento ----------

  async listShares(req: Request, res: Response) {
    try {
      await assertCanShare(Number(req.params.id), req.user);
      return res.json(await listResourceShares('dashboard', Number(req.params.id), req.user));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async share(req: Request, res: Response) {
    const parsed = shareSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }
    try {
      const dashboard = await assertCanShare(Number(req.params.id), req.user);
      const concessao = await shareResource({
        recursoTipo: 'dashboard',
        recursoId: dashboard.id,
        data: parsed.data,
        user: req.user,
      });
      await auditFromRequest(req, {
        acao: 'permission_change',
        entidade: 'dashboard_compartilhamento',
        entidadeId: concessao.id,
        descricao: `Compartilhou o dashboard "${dashboard.nome}" (${concessao.escopo}, ${concessao.acesso})`,
        depois: concessao,
      });
      return res.status(201).json(concessao);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async revoke(req: Request, res: Response) {
    try {
      await assertCanShare(Number(req.params.id), req.user);
      const removido = await revokeShare(Number(req.params.shareId), req.user);
      await auditFromRequest(req, {
        acao: 'permission_change',
        entidade: 'dashboard_compartilhamento',
        entidadeId: req.params.shareId,
        descricao: 'Revogou um compartilhamento de dashboard',
        antes: removido,
      });
      return res.status(204).send();
    } catch (error) {
      return handleError(error, res);
    }
  },

  /// Visão administrativa: tudo que foi compartilhado dentro da empresa.
  async tenantShares(req: Request, res: Response) {
    try {
      const tipo = req.query.tipo as ShareResourceType | undefined;
      return res.json(await listTenantShares(tipo, req.user));
    } catch (error) {
      return handleError(error, res);
    }
  },

  /// Wallboard público — sem sessão, resolvido pelo token do link.
  async publicView(req: Request, res: Response) {
    const dashboard = await getPublicDashboard(String(req.params.token));
    if (!dashboard) return res.status(404).json({ error: 'Link inválido ou expirado' });
    return res.json(dashboard);
  },
};
