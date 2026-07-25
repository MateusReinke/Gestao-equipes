import { JwtPayload } from '../types/auth';
import { teamRepository } from '../repositories/team.repository';

export async function getVisibleTeamIds(user?: JwtPayload): Promise<number[]> {
  if (!user || user.activeTenantId == null) return [];

  if (user.isGlobalAdmin || user.role === 'admin') {
    const teams = await teamRepository.findAllIds(user.activeTenantId);
    return teams.map((team) => team.id);
  }

  const managerTeams = await teamRepository.findManagerTeamIds(user.userId, user.activeTenantId);
  return managerTeams.map((item) => item.equipeId);
}
