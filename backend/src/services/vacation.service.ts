import { JwtPayload } from '../types/auth';
import { vacationRepository } from '../repositories/vacation.repository';
import { getVisibleTeamIds } from './scope.service';

export async function listVacationsForUser(user?: JwtPayload) {
  const teamIds = await getVisibleTeamIds(user);
  return vacationRepository.findByTeamIds(teamIds);
}
