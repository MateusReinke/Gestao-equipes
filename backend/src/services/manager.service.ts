import { managerRepository } from '../repositories/manager.repository';

export async function listManagers(tenantId: number) {
  const memberships = await managerRepository.findAll(tenantId);
  return memberships.map((membership) => ({
    id: membership.user.id,
    nome: membership.user.nome,
    email: membership.user.email,
    colaborador: membership.colaborador,
    gestorEquipes: membership.user.gestorEquipes,
  }));
}
