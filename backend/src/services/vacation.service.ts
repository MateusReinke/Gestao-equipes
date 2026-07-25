import { JwtPayload } from '../types/auth';
import { vacationRepository } from '../repositories/vacation.repository';
import { getVisibleTeamIds } from './scope.service';

export async function listVacationsForUser(user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return [];
  const teamIds = await getVisibleTeamIds(user);
  return vacationRepository.findByTeamIds(user.activeTenantId, teamIds);
}
