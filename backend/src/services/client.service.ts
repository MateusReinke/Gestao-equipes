import { z } from 'zod';
import { JwtPayload } from '../types/auth';
import { clientRepository } from '../repositories/client.repository';
import { collaboratorRepository } from '../repositories/collaborator.repository';

export const clientSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do cliente é obrigatório'),
  idWhatsapp: z.string().trim().min(5, 'Informe o ID do WhatsApp'),
  escalation: z.string().trim().email('Informe um e-mail válido de escalation'),
  responsavelInternoId: z.coerce.number().int().positive('Selecione um responsável válido'),
  ativo: z.coerce.boolean().default(true),
});

export type ClientInput = z.infer<typeof clientSchema>;

export class ClientNotFoundError extends Error {}
export class NoActiveTenantError extends Error {}
export class ResponsibleNotFoundError extends Error {}

export async function listClients(tenantId: number) {
  return clientRepository.findAll(tenantId);
}

export async function getClientResponsible(tenantId: number, clientId: number) {
  const client = await clientRepository.findById(tenantId, clientId);
  if (!client) throw new ClientNotFoundError('Cliente não encontrado');
  return { cliente: { id: client.id, nome: client.nome }, responsavel: client.responsavelInterno };
}

export async function createClient(data: ClientInput, user?: JwtPayload) {
  if (!user || user.activeTenantId == null) {
    throw new NoActiveTenantError('Selecione um tenant ativo para cadastrar clientes');
  }
  const tenantId = user.activeTenantId;

  const responsible = await collaboratorRepository.findById(tenantId, data.responsavelInternoId);
  if (!responsible) throw new ResponsibleNotFoundError('Responsável interno informado não existe nesta empresa');

  return clientRepository.create(tenantId, data);
}
