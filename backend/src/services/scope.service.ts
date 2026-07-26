import { JwtPayload } from '../types/auth';
import { teamRepository } from '../repositories/team.repository';
import { userHasPermission } from './permission.service';
import { PERMISSIONS } from '../types/permissions';

/**
 * Equipes que o usuário enxerga dentro do tenant ativo.
 * Quem administra a empresa (ou tem permissão ampla de equipes) vê todas;
 * os demais veem apenas as equipes sob sua gestão.
 */
export async function getVisibleTeamIds(user?: JwtPayload): Promise<number[]> {
  if (!user || user.activeTenantId == null) return [];
  const tenantId = user.activeTenantId;

  const veTudo =
    user.isGlobalAdmin ||
    (await userHasPermission(user, PERMISSIONS.TEAM_EDIT)) ||
    (await userHasPermission(user, PERMISSIONS.TENANT_SETTINGS_MANAGE));

  if (veTudo) {
    const teams = await teamRepository.findAllIds(tenantId);
    return teams.map((team) => team.id);
  }

  const managerTeams = await teamRepository.findManagerTeamIds(user.userId, tenantId);
  return managerTeams.map((item) => item.equipeId);
}
