import { JwtPayload } from '../types/auth';
import { scaleRepository } from '../repositories/scale.repository';
import { getVisibleTeamIds } from './scope.service';

export async function listScalesForUser(user?: JwtPayload) {
  const teamIds = await getVisibleTeamIds(user);
  return scaleRepository.findByTeamIds(teamIds);
}
