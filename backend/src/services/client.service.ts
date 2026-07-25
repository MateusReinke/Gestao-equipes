import { z } from 'zod';
import { JwtPayload } from '../types/auth';
import { clientRepository } from '../repositories/client.repository';
import { collaboratorRepository } from '../repositories/collaborator.repository';

export const clientSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do cliente é obrigatório'),
  idWhatsapp: z.string().trim().min(5, 'Informe o ID do WhatsApp'),
  escalation: z.string().trim().email('Informe um e-mail válido de escalation'),
  responsavelInternoId: z.coerce.number().int().positive().optional().nullable(),
  ativo: z.coerce.boolean().default(true),
});

export const updateClientSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do cliente é obrigatório').optional(),
  idWhatsapp: z.string().trim().min(5, 'Informe o ID do WhatsApp').optional(),
  escalation: z.string().trim().email('Informe um e-mail válido de escalation').optional(),
  responsavelInternoId: z.coerce.number().int().positive().nullable().optional(),
  ativo: z.boolean().optional(),
});

export type ClientInput = z.infer<typeof clientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

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

async function assertResponsibleBelongsToTenant(tenantId: number, responsavelInternoId?: number | null) {
  if (responsavelInternoId == null) return;
  const responsible = await collaboratorRepository.findById(tenantId, responsavelInternoId);
  if (!responsible) throw new ResponsibleNotFoundError('Responsável interno informado não existe nesta empresa');
}

export async function createClient(data: ClientInput, user?: JwtPayload) {
  if (!user || user.activeTenantId == null) {
    throw new NoActiveTenantError('Selecione um tenant ativo para cadastrar clientes');
  }
  const tenantId = user.activeTenantId;

  await assertResponsibleBelongsToTenant(tenantId, data.responsavelInternoId);

  return clientRepository.create(tenantId, data);
}

export async function updateClient(clientId: number, data: UpdateClientInput, user?: JwtPayload) {
  if (!user || user.activeTenantId == null) {
    throw new NoActiveTenantError('Selecione um tenant ativo para editar clientes');
  }
  const tenantId = user.activeTenantId;

  const existing = await clientRepository.findById(tenantId, clientId);
  if (!existing) throw new ClientNotFoundError('Cliente não encontrado');

  if ('responsavelInternoId' in data) {
    await assertResponsibleBelongsToTenant(tenantId, data.responsavelInternoId);
  }

  return clientRepository.update(tenantId, clientId, data);
}
