import { Router } from 'express';
import { apiController } from '../controllers/api.controller';
import { auth } from '../middleware/auth';

export const router = Router();

router.get('/health', apiController.health);
router.post('/auth/login', apiController.login);
router.get('/auth/me', auth(), apiController.me);

router.get('/api/dashboard', auth(['admin', 'gestor', 'rh', 'monitoramento']), apiController.dashboard);
router.get('/plantao/atual', auth(), apiController.currentOnCall);
router.get('/clientes/:id/responsavel', auth(), apiController.clientResponsible);
router.get('/clientes/:id/plantonista', auth(), apiController.clientOnCall);

router.get('/api/clientes', auth(), apiController.clients);
router.get('/api/equipes', auth(['admin', 'gestor', 'rh', 'monitoramento']), apiController.teams);
router.get('/api/colaboradores', auth(['admin', 'gestor']), apiController.collaborators);
router.post('/api/colaboradores', auth(['admin', 'gestor']), apiController.createCollaborator);
router.get('/api/gestores', auth(['admin']), apiController.managers);
router.get('/api/escalas', auth(['admin', 'gestor', 'monitoramento']), apiController.scales);
router.get('/api/plantoes', auth(['admin', 'gestor', 'monitoramento']), apiController.onCalls);
router.get('/api/ferias', auth(['admin', 'gestor', 'rh']), apiController.vacations);
