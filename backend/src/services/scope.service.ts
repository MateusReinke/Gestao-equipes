import { JwtPayload } from '../types/auth';
import { teamRepository } from '../repositories/team.repository';

export async function getVisibleTeamIds(user?: JwtPayload): Promise<number[]> {
  if (!user) return [];
  if (user.role === 'admin') {
    const teams = await teamRepository.findAllIds();
    return teams.map((team) => team.id);
  }

  const managerTeams = await teamRepository.findManagerTeamIds(user.userId);
  return managerTeams.map((item) => item.equipeId);
}
