export type SessionUser = { id: number; nome: string; email: string; isGlobalAdmin: boolean };
export type SessionTenant = { id: number; nome: string; slug: string };

export type SessionInfo = {
  token: string;
  user: SessionUser;
  tenant: SessionTenant | null;
  roleCodigo: string | null;
  activeTenantId: number | null;
  permissoes: string[];
};

/// Catálogo de permissões usado no frontend para decidir menu e ações visíveis.
/// Espelha `backend/src/types/permissions.ts`.
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_CREATE: 'dashboard.create',
  DASHBOARD_EDIT: 'dashboard.edit',
  DASHBOARD_DELETE: 'dashboard.delete',
  DASHBOARD_SHARE: 'dashboard.share',
  SHARE_MANAGE: 'share.manage',
  CLIENT_VIEW: 'client.view',
  CLIENT_CREATE: 'client.create',
  CLIENT_EDIT: 'client.edit',
  CLIENT_DELETE: 'client.delete',
  TEAM_VIEW: 'team.view',
  TEAM_CREATE: 'team.create',
  TEAM_EDIT: 'team.edit',
  TEAM_DELETE: 'team.delete',
  COLLABORATOR_VIEW: 'collaborator.view',
  COLLABORATOR_CREATE: 'collaborator.create',
  COLLABORATOR_EDIT: 'collaborator.edit',
  COLLABORATOR_DELETE: 'collaborator.delete',
  SCHEDULE_VIEW: 'schedule.view',
  SCHEDULE_CREATE: 'schedule.create',
  SCHEDULE_EDIT: 'schedule.edit',
  SCHEDULE_DELETE: 'schedule.delete',
  SCHEDULE_GENERATE: 'schedule.generate',
  SHIFT_VIEW: 'shift.view',
  SHIFT_EDIT: 'shift.edit',
  SHIFT_REQUEST_SWAP: 'shift.request_swap',
  SHIFT_APPROVE_SWAP: 'shift.approve_swap',
  HR_VACATION_VIEW: 'hr.vacation.view',
  HR_VACATION_REQUEST: 'hr.vacation.request',
  HR_VACATION_APPROVE: 'hr.vacation.approve',
  HR_ABSENCE_VIEW: 'hr.absence.view',
  HR_ABSENCE_MANAGE: 'hr.absence.manage',
  USER_VIEW: 'user.view',
  USER_INVITE: 'user.invite',
  USER_EDIT: 'user.edit',
  USER_MANAGE_ROLES: 'user.manage_roles',
  REPORT_VIEW: 'report.view',
  REPORT_EXPORT: 'report.export',
  ROLE_MANAGE: 'role.manage',
  TENANT_SETTINGS_MANAGE: 'tenant.settings.manage',
  AUDIT_VIEW: 'audit.view',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function can(permissoes: string[], ...requeridas: PermissionCode[]) {
  return requeridas.some((permissao) => permissoes.includes(permissao));
}
