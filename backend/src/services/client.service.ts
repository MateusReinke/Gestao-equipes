import { clientRepository } from '../repositories/client.repository';

export class ClientNotFoundError extends Error {}

export async function listClients(tenantId: number) {
  return clientRepository.findAll(tenantId);
}

export async function getClientResponsible(tenantId: number, clientId: number) {
  const client = await clientRepository.findById(tenantId, clientId);
  if (!client) throw new ClientNotFoundError('Cliente não encontrado');
  return { cliente: { id: client.id, nome: client.nome }, responsavel: client.responsavelInterno };
}
