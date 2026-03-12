import { Router } from 'express';
import { apiController } from '../controllers/api.controller';
import { auth } from '../middleware/auth';

export const router = Router();

router.get('/health', apiController.health);
router.post('/auth/login', apiController.login);

router.get('/api/dashboard', apiController.dashboard);

router.get('/api/plantonista/hoje', apiController.plantonistaHoje);
router.get('/api/plantonista/agora', apiController.plantonistaAgora);
router.get('/api/plantao/hoje', apiController.plantonistaHoje);
router.get('/api/plantao/agora', apiController.plantonistaAgora);

router.get('/api/escala/data', apiController.escalaData);
router.get('/api/escala/colaborador/:colaboradorId', apiController.escalaColaborador);
router.post('/api/escala', auth(['admin', 'gestor']), apiController.createEscala);

router.post('/api/plantoes', auth(['admin', 'gestor']), apiController.createPlantao);
router.post('/api/ferias', auth(['admin', 'gestor']), apiController.createFerias);
router.post('/api/feriados', auth(['admin', 'gestor']), apiController.createFeriado);

router.get('/api/colaboradores', apiController.colaboradores);
router.get('/api/equipes', apiController.equipes);
router.get('/api/clientes', apiController.clientes);
router.get('/api/turnos', apiController.turnos);
router.get('/api/ferias', apiController.ferias);
router.get('/api/feriados', apiController.feriados);
