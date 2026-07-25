import { JwtPayload } from '../types/auth';
import { getVisibleTeamIds } from './scope.service';
import { getCurrentOnCall, getUpcomingOnCall, dayBounds } from './oncall.service';
import { teamRepository } from '../repositories/team.repository';
import { collaboratorRepository } from '../repositories/collaborator.repository';
import { clientRepository } from '../repositories/client.repository';
import { vacationRepository } from '../repositories/vacation.repository';
import { scaleRepository } from '../repositories/scale.repository';

const EMPTY_DASHBOARD = {
  metrics: { clients: 0, teams: 0, collaborators: 0, currentOnCall: 0, activeVacations: 0, activeScales: 0 },
  currentOnCall: [],
  upcomingOnCall: [],
  teams: [],
  collaborators: [],
  clients: [],
  vacations: [],
  scales: [],
};

export async function getDashboard(user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return EMPTY_DASHBOARD;
  const tenantId = user.activeTenantId;

  const visibleTeamIds = await getVisibleTeamIds(user);
  const { start, end } = dayBounds();

  const [currentOnCall, upcomingOnCall, teams, collaborators, clients, vacations, scales] = await Promise.all([
    getCurrentOnCall(undefined, user),
    getUpcomingOnCall(undefined, user),
    teamRepository.countByIds(tenantId, visibleTeamIds),
    collaboratorRepository.findActiveByTeamIds(tenantId, visibleTeamIds),
    clientRepository.findByTeamIds(tenantId, visibleTeamIds),
    vacationRepository.findApprovedInRangeForTeams(tenantId, visibleTeamIds, start, end),
    scaleRepository.findByTeamIds(tenantId, visibleTeamIds),
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
