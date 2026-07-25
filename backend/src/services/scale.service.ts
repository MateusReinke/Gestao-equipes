import { JwtPayload } from '../types/auth';
import { scaleRepository } from '../repositories/scale.repository';
import { getVisibleTeamIds } from './scope.service';

export async function listScalesForUser(user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return [];
  const teamIds = await getVisibleTeamIds(user);
  return scaleRepository.findByTeamIds(user.activeTenantId, teamIds);
}
