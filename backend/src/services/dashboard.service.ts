import { JwtPayload } from '../types/auth';
import { getVisibleTeamIds } from './scope.service';
import { getCurrentOnCall, getUpcomingOnCall, dayBounds } from './oncall.service';
import { teamRepository } from '../repositories/team.repository';
import { collaboratorRepository } from '../repositories/collaborator.repository';
import { clientRepository } from '../repositories/client.repository';
import { vacationRepository } from '../repositories/vacation.repository';
import { scaleRepository } from '../repositories/scale.repository';

export async function getDashboard(user?: JwtPayload) {
  const visibleTeamIds = await getVisibleTeamIds(user);
  const { start, end } = dayBounds();

  const [currentOnCall, upcomingOnCall, teams, collaborators, clients, vacations, scales] = await Promise.all([
    getCurrentOnCall(undefined, user),
    getUpcomingOnCall(undefined, user),
    teamRepository.countByIds(visibleTeamIds),
    collaboratorRepository.findActiveByTeamIds(visibleTeamIds),
    clientRepository.findByTeamIds(visibleTeamIds),
    vacationRepository.findApprovedInRangeForTeams(visibleTeamIds, start, end),
    scaleRepository.findByTeamIds(visibleTeamIds),
  ]);

  return {
    metrics: {
      clients: clients.length,
      teams: teams.length,
      collaborators: collaborators.length,
      currentOnCall: currentOnCall.length,
      activeVacations: vacations.length,
      activeScales: scales.length,
    },
    currentOnCall,
    upcomingOnCall,
    teams,
    collaborators,
    clients,
    vacations,
    scales,
  };
}
