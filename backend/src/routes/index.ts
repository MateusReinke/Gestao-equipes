import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/requirePermission';
import { asyncHandler } from '../middleware/asyncHandler';
import { PERMISSIONS as P } from '../types/permissions';
import { authController } from '../controllers/auth.controller';
import { dashboardController } from '../controllers/dashboard.controller';
import { clientController } from '../controllers/client.controller';
import { teamController } from '../controllers/team.controller';
import { collaboratorController } from '../controllers/collaborator.controller';
import { scaleController } from '../controllers/scale.controller';
import { shiftController } from '../controllers/shift.controller';
import { swapController } from '../controllers/swap.controller';
import { hrController } from '../controllers/hr.controller';
import { rbacController } from '../controllers/rbac.controller';
import { auditController } from '../controllers/audit.controller';
import { lookupController } from '../controllers/lookup.controller';
import { tenantController } from '../controllers/tenant.controller';

export const router = Router();

// ---------- Público ----------
router.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
router.post('/auth/login', asyncHandler(authController.login));

// ---------- Sessão ----------
router.post('/auth/switch-tenant', auth({ requireGlobalAdmin: true, requireTenant: false }), asyncHandler(authController.switchTenant));
router.get('/auth/me', auth({ requireTenant: false }), asyncHandler(rbacController.me));

// ---------- Console da plataforma (Administrador Global) ----------
router.get('/platform/tenants', auth({ requireGlobalAdmin: true, requireTenant: false }), asyncHandler(tenantController.list));
router.post('/platform/tenants', auth({ requireGlobalAdmin: true, requireTenant: false }), asyncHandler(tenantController.create));
router.patch('/platform/tenants/:id', auth({ requireGlobalAdmin: true, requireTenant: false }), asyncHandler(tenantController.update));
router.delete('/platform/tenants/:id', auth({ requireGlobalAdmin: true, requireTenant: false }), asyncHandler(tenantController.remove));

// ---------- Dashboard ----------
router.get('/api/dashboard', auth(), requirePermission(P.DASHBOARD_VIEW), asyncHandler(dashboardController.show));

// ---------- Clientes ----------
router.get('/api/clientes', auth(), requirePermission(P.CLIENT_VIEW), asyncHandler(clientController.list));
router.post('/api/clientes', auth(), requirePermission(P.CLIENT_CREATE), asyncHandler(clientController.create));
router.patch('/api/clientes/:id', auth(), requirePermission(P.CLIENT_EDIT), asyncHandler(clientController.update));
router.delete('/api/clientes/:id', auth(), requirePermission(P.CLIENT_DELETE), asyncHandler(clientController.remove));
router.get('/clientes/:id/responsavel', auth(), requirePermission(P.CLIENT_VIEW), asyncHandler(clientController.responsible));
router.get('/clientes/:id/plantonista', auth(), requirePermission(P.SHIFT_VIEW), asyncHandler(clientController.onCall));

// ---------- Equipes ----------
router.get('/api/equipes', auth(), requirePermission(P.TEAM_VIEW), asyncHandler(teamController.list));
router.post('/api/equipes', auth(), requirePermission(P.TEAM_CREATE), asyncHandler(teamController.create));
router.patch('/api/equipes/:id', auth(), requirePermission(P.TEAM_EDIT), asyncHandler(teamController.update));

// ---------- Colaboradores ----------
router.get('/api/colaboradores', auth(), requirePermission(P.COLLABORATOR_VIEW), asyncHandler(collaboratorController.list));
router.post('/api/colaboradores', auth(), requirePermission(P.COLLABORATOR_CREATE), asyncHandler(collaboratorController.create));
router.patch('/api/colaboradores/:id', auth(), requirePermission(P.COLLABORATOR_EDIT), asyncHandler(collaboratorController.update));

// ---------- Escalas (regras) ----------
router.get('/api/escalas', auth(), requirePermission(P.SCHEDULE_VIEW), asyncHandler(scaleController.list));
router.get('/api/escalas/:id', auth(), requirePermission(P.SCHEDULE_VIEW), asyncHandler(scaleController.show));
router.post('/api/escalas', auth(), requirePermission(P.SCHEDULE_CREATE), asyncHandler(scaleController.create));
router.patch('/api/escalas/:id', auth(), requirePermission(P.SCHEDULE_EDIT), asyncHandler(scaleController.update));
router.delete('/api/escalas/:id', auth(), requirePermission(P.SCHEDULE_DELETE), asyncHandler(scaleController.remove));

// ---------- Turnos (execução da escala) ----------
router.get('/api/turnos', auth(), requirePermission(P.SHIFT_VIEW), asyncHandler(shiftController.list));
router.get('/api/turnos/colaborador/:colaboradorId', auth(), requirePermission(P.SHIFT_VIEW), asyncHandler(shiftController.mine));
router.post('/api/turnos/gerar', auth(), requirePermission(P.SCHEDULE_GENERATE), asyncHandler(shiftController.generate));
router.post('/api/turnos', auth(), requirePermission(P.SHIFT_EDIT), asyncHandler(shiftController.create));
router.patch('/api/turnos/:id', auth(), requirePermission(P.SHIFT_EDIT), asyncHandler(shiftController.update));
router.get('/plantao/atual', auth(), requirePermission(P.SHIFT_VIEW), asyncHandler(shiftController.current));
router.get('/api/plantoes', auth(), requirePermission(P.SHIFT_VIEW), asyncHandler(shiftController.upcoming));

// ---------- Trocas de turno ----------
router.get('/api/trocas', auth(), requirePermission(P.SHIFT_VIEW), asyncHandler(swapController.list));
router.post('/api/trocas', auth(), requirePermission(P.SHIFT_REQUEST_SWAP), asyncHandler(swapController.request));
router.post('/api/trocas/:id/aceitar', auth(), requirePermission(P.SHIFT_REQUEST_SWAP, P.SHIFT_APPROVE_SWAP), asyncHandler(swapController.accept));
router.post('/api/trocas/:id/aprovar', auth(), requirePermission(P.SHIFT_APPROVE_SWAP), asyncHandler(swapController.approve));
router.post('/api/trocas/:id/rejeitar', auth(), requirePermission(P.SHIFT_REQUEST_SWAP, P.SHIFT_APPROVE_SWAP), asyncHandler(swapController.reject));
router.post('/api/trocas/:id/cancelar', auth(), requirePermission(P.SHIFT_REQUEST_SWAP, P.SHIFT_APPROVE_SWAP), asyncHandler(swapController.cancel));

// ---------- RH ----------
router.get('/api/ferias', auth(), requirePermission(P.HR_VACATION_VIEW), asyncHandler(hrController.listVacations));
router.post('/api/ferias', auth(), requirePermission(P.HR_VACATION_REQUEST), asyncHandler(hrController.requestVacation));
router.patch('/api/ferias/:id', auth(), requirePermission(P.HR_VACATION_APPROVE), asyncHandler(hrController.respondVacation));
router.get('/api/ausencias', auth(), requirePermission(P.HR_ABSENCE_VIEW), asyncHandler(hrController.listAbsences));
router.post('/api/ausencias', auth(), requirePermission(P.HR_ABSENCE_MANAGE), asyncHandler(hrController.createAbsence));
router.patch('/api/ausencias/:id', auth(), requirePermission(P.HR_ABSENCE_MANAGE), asyncHandler(hrController.respondAbsence));

// ---------- RBAC / administração ----------
router.get('/api/permissoes', auth(), requirePermission(P.ROLE_MANAGE, P.USER_MANAGE_ROLES), asyncHandler(rbacController.listPermissions));
router.get('/api/papeis', auth(), requirePermission(P.ROLE_MANAGE, P.USER_MANAGE_ROLES, P.USER_VIEW), asyncHandler(rbacController.listRoles));
router.post('/api/papeis', auth(), requirePermission(P.ROLE_MANAGE), asyncHandler(rbacController.createRole));
router.patch('/api/papeis/:id', auth(), requirePermission(P.ROLE_MANAGE), asyncHandler(rbacController.updateRole));
router.delete('/api/papeis/:id', auth(), requirePermission(P.ROLE_MANAGE), asyncHandler(rbacController.deleteRole));
router.get('/api/usuarios', auth(), requirePermission(P.USER_VIEW), asyncHandler(rbacController.listUsers));
router.post('/api/usuarios', auth(), requirePermission(P.USER_INVITE), asyncHandler(rbacController.inviteUser));
router.patch('/api/usuarios/:userId', auth(), requirePermission(P.USER_MANAGE_ROLES, P.USER_EDIT), asyncHandler(rbacController.updateUser));

// ---------- Auditoria ----------
router.get('/api/auditoria', auth(), requirePermission(P.AUDIT_VIEW), asyncHandler(auditController.list));

// ---------- Integrações públicas (preenchimento automático de cadastro) ----------
router.get('/api/lookup/cnpj/:cnpj', auth(), requirePermission(P.CLIENT_CREATE, P.CLIENT_EDIT), asyncHandler(lookupController.cnpj));
router.get('/api/lookup/cep/:cep', auth(), requirePermission(P.CLIENT_CREATE, P.CLIENT_EDIT), asyncHandler(lookupController.cep));
