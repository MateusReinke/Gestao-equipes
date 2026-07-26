import { JwtPayload } from '../types/auth';
import { getVisibleTeamIds } from './scope.service';
import { getCurrentShifts, getUpcomingShifts } from './shift.service';
import { teamRepository } from '../repositories/team.repository';
import { collaboratorRepository } from '../repositories/collaborator.repository';
import { clientRepository } from '../repositories/client.repository';
import { vacationRepository } from '../repositories/vacation.repository';
import { absenceRepository } from '../repositories/absence.repository';
import { scaleRepository } from '../repositories/scale.repository';
import { swapRepository } from '../repositories/swap.repository';
import { shiftRepository } from '../repositories/shift.repository';
import { addDays, dayBounds } from '../utils/date';

const EMPTY_DASHBOARD = {
  metrics: {
    clients: 0,
    teams: 0,
    collaborators: 0,
    currentOnCall: 0,
    activeVacations: 0,
    activeScales: 0,
    pendingSwaps: 0,
    shiftsNext7Days: 0,
  },
  currentOnCall: [] as unknown[],
  upcomingOnCall: [] as unknown[],
  teams: [] as unknown[],
  collaborators: [] as unknown[],
  clients: [] as unknown[],
  vacations: [] as unknown[],
  absences: [] as unknown[],
  scales: [] as unknown[],
  pendingSwaps: [] as unknown[],
};

export async function getDashboard(user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return EMPTY_DASHBOARD;
  const tenantId = user.activeTenantId;

  const visibleTeamIds = await getVisibleTeamIds(user);
  if (visibleTeamIds.length === 0) return EMPTY_DASHBOARD;

  const { start } = dayBounds();
  const proximaSemana = addDays(start, 7);

  const [currentOnCall, upcomingOnCall, teams, collaborators, clients, vacations, absences, scales, pendingSwaps, shiftsSemana] =
    await Promise.all([
      getCurrentShifts(undefined, user),
      getUpcomingShifts(undefined, user, 8),
      teamRepository.countByIds(tenantId, visibleTeamIds),
      collaboratorRepository.findActiveByTeamIds(tenantId, visibleTeamIds),
      clientRepository.findByTeamIds(tenantId, visibleTeamIds),
      vacationRepository.findApprovedInRangeForTeams(tenantId, visibleTeamIds, start, start),
      absenceRepository.findApprovedOverlapping(tenantId, start, start),
      scaleRepository.findByTeamIds(tenantId, visibleTeamIds),
      swapRepository.list(tenantId, { status: 'pendente', teamIds: visibleTeamIds }),
      shiftRepository.findByRange({ tenantId, inicio: start, fim: proximaSemana, teamIds: visibleTeamIds }),
    ]);

  return {
    metrics: {
      clients: clients.length,
      teams: teams.length,
      collaborators: collaborators.length,
      currentOnCall: currentOnCall.length,
      activeVacations: vacations.length,
      activeScales: scales.length,
      pendingSwaps: pendingSwaps.length,
      shiftsNext7Days: shiftsSemana.length,
    },
    currentOnCall,
    upcomingOnCall,
    teams,
    collaborators,
    clients,
    vacations,
    absences,
    scales,
    pendingSwaps,
  };
}
