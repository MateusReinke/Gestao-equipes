import type { SessionUser } from './api';

export const ROUTE_ROLES: Record<string, SessionUser['role'][]> = {
  '/': ['admin', 'gestor', 'rh', 'monitoramento'],
  '/clientes': ['admin', 'gestor', 'rh', 'monitoramento', 'cliente'],
  '/equipes': ['admin', 'gestor', 'rh', 'monitoramento'],
  '/colaboradores': ['admin', 'gestor'],
  '/gestores': ['admin'],
  '/escalas': ['admin', 'gestor', 'monitoramento'],
  '/plantoes': ['admin', 'gestor', 'monitoramento'],
  '/ferias': ['admin', 'gestor', 'rh'],
};
