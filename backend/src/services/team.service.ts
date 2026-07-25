import { JwtPayload } from '../types/auth';
import { teamRepository } from '../repositories/team.repository';
import { getVisibleTeamIds } from './scope.service';

export async function listTeamsForUser(user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return [];
  const teamIds = await getVisibleTeamIds(user);
  return teamRepository.findByIds(user.activeTenantId, teamIds);
}
