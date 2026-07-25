import { JwtPayload } from '../types/auth';
import { oncallRepository } from '../repositories/oncall.repository';
import { vacationRepository } from '../repositories/vacation.repository';
import { getVisibleTeamIds } from './scope.service';

export function dayBounds(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isTimeBetween(nowMinutes: number, start: string, end: string) {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (endMinutes >= startMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export async function getCurrentOnCall(clientId: number | undefined, user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return [];
  const tenantId = user.activeTenantId;
  const { start, end } = dayBounds();
  const visibleTeamIds = await getVisibleTeamIds(user);
  const nowMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();

  const vacations = await vacationRepository.findApprovedInRange(tenantId, start, end);
  const onCalls = await oncallRepository.findForDay({
    tenantId,
    start,
    end,
    clientId,
    teamIds: visibleTeamIds,
    excludeCollaboratorIds: vacations.map((item) => item.colaboradorId),
  });

  return onCalls.filter((item) => isTimeBetween(nowMinutes, item.horaInicio, item.horaFim));
}

export async function getUpcomingOnCall(clientId: number | undefined, user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return [];
  const visibleTeamIds = await getVisibleTeamIds(user);
  const { start } = dayBounds();
  return oncallRepository.findUpcoming({ tenantId: user.activeTenantId, start, clientId, teamIds: visibleTeamIds, take: 10 });
}

export async function listOnCallsForUser(user?: JwtPayload) {
  if (!user || user.activeTenantId == null) return [];
  const teamIds = await getVisibleTeamIds(user);
  return oncallRepository.findByTeamIds(user.activeTenantId, teamIds);
}
