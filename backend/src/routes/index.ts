import { Router } from 'express';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { authController } from '../controllers/auth.controller';
import { dashboardController } from '../controllers/dashboard.controller';
import { oncallController } from '../controllers/oncall.controller';
import { clientController } from '../controllers/client.controller';
import { teamController } from '../controllers/team.controller';
import { collaboratorController } from '../controllers/collaborator.controller';
import { managerController } from '../controllers/manager.controller';
import { scaleController } from '../controllers/scale.controller';
import { vacationController } from '../controllers/vacation.controller';

export const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
router.post('/auth/login', asyncHandler(authController.login));

router.get('/api/dashboard', auth(), asyncHandler(dashboardController.show));
router.get('/plantao/atual', auth(), asyncHandler(oncallController.current));
router.get('/clientes/:id/responsavel', auth(), asyncHandler(clientController.responsible));
router.get('/clientes/:id/plantonista', auth(), asyncHandler(clientController.onCall));

router.get('/api/clientes', auth(), asyncHandler(clientController.list));
router.get('/api/equipes', auth(), asyncHandler(teamController.list));
router.get('/api/colaboradores', auth(), asyncHandler(collaboratorController.list));
router.post('/api/colaboradores', auth(), asyncHandler(collaboratorController.create));
router.get('/api/gestores', auth(['admin']), asyncHandler(managerController.list));
router.get('/api/escalas', auth(), asyncHandler(scaleController.list));
router.get('/api/plantoes', auth(), asyncHandler(oncallController.list));
router.get('/api/ferias', auth(), asyncHandler(vacationController.list));
