import { clientRepository } from '../repositories/client.repository';

export class ClientNotFoundError extends Error {}

export async function listClients() {
  return clientRepository.findAll();
}

export async function getClientResponsible(clientId: number) {
  const client = await clientRepository.findById(clientId);
  if (!client) throw new ClientNotFoundError('Cliente não encontrado');
  return { cliente: { id: client.id, nome: client.nome }, responsavel: client.responsavelInterno };
}
