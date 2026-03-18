import { Router } from 'express';
import { apiController } from '../controllers/api.controller';
import { auth } from '../middleware/auth';

export const router = Router();

router.get('/health', apiController.health);
router.post('/auth/login', apiController.login);

router.get('/api/dashboard', auth(), apiController.dashboard);
router.get('/plantao/atual', auth(), apiController.currentOnCall);
router.get('/clientes/:id/responsavel', auth(), apiController.clientResponsible);
router.get('/clientes/:id/plantonista', auth(), apiController.clientOnCall);

router.get('/api/clientes', auth(), apiController.clients);
router.get('/api/equipes', auth(), apiController.teams);
router.get('/api/colaboradores', auth(), apiController.collaborators);
router.get('/api/gestores', auth(['admin']), apiController.managers);
router.get('/api/escalas', auth(), apiController.scales);
router.get('/api/plantoes', auth(), apiController.onCalls);
router.get('/api/ferias', auth(), apiController.vacations);
