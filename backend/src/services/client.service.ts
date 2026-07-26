import { z } from 'zod';
import { JwtPayload } from '../types/auth';
import { clientRepository } from '../repositories/client.repository';
import { collaboratorRepository } from '../repositories/collaborator.repository';
import { onlyDigits } from './lookup.service';

const enderecoFields = {
  cep: z.string().trim().max(9).nullable().optional(),
  logradouro: z.string().trim().max(200).nullable().optional(),
  numero: z.string().trim().max(20).nullable().optional(),
  complemento: z.string().trim().max(100).nullable().optional(),
  bairro: z.string().trim().max(100).nullable().optional(),
  cidade: z.string().trim().max(100).nullable().optional(),
  uf: z.string().trim().length(2, 'UF deve ter 2 letras').nullable().optional(),
};

export const clientSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do cliente é obrigatório'),
  razaoSocial: z.string().trim().max(200).nullable().optional(),
  cnpj: z.string().trim().max(18).nullable().optional(),
  idWhatsapp: z.string().trim().min(3, 'Informe o ID do grupo de WhatsApp'),
  escalation: z.string().trim().email('Informe um e-mail válido de escalation'),
  telefone: z.string().trim().max(20).nullable().optional(),
  site: z.string().trim().max(200).nullable().optional(),
  slaMinutos: z.coerce.number().int().positive().nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
  responsavelInternoId: z.coerce.number().int().positive().nullable().optional(),
  ativo: z.coerce.boolean().default(true),
  ...enderecoFields,
});

export const updateClientSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do cliente é obrigatório').optional(),
  razaoSocial: z.string().trim().max(200).nullable().optional(),
  cnpj: z.string().trim().max(18).nullable().optional(),
  idWhatsapp: z.string().trim().min(3).optional(),
  escalation: z.string().trim().email('Informe um e-mail válido de escalation').optional(),
  telefone: z.string().trim().max(20).nullable().optional(),
  site: z.string().trim().max(200).nullable().optional(),
  slaMinutos: z.coerce.number().int().positive().nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
  responsavelInternoId: z.coerce.number().int().positive().nullable().optional(),
  ativo: z.boolean().optional(),
  ...enderecoFields,
});

export type ClientInput = z.infer<typeof clientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export class ClientNotFoundError extends Error {}
export class NoActiveTenantError extends Error {}
export class ResponsibleNotFoundError extends Error {}

function requireTenant(user?: JwtPayload): number {
  if (!user || user.activeTenantId == null) {
    throw new NoActiveTenantError('Selecione uma empresa ativa para gerenciar clientes');
  }
  return user.activeTenantId;
}

/// Normaliza documentos para guardar só dígitos, evitando duplicidade por formatação.
function normalize<T extends { cnpj?: string | null; cep?: string | null }>(data: T): T {
  return {
    ...data,
    ...(data.cnpj !== undefined ? { cnpj: data.cnpj ? onlyDigits(data.cnpj) : null } : {}),
    ...(data.cep !== undefined ? { cep: data.cep ? onlyDigits(data.cep) : null } : {}),
  };
}

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
  const tenantId = requireTenant(user);
  await assertResponsibleBelongsToTenant(tenantId, data.responsavelInternoId);
  return clientRepository.create(tenantId, normalize(data));
}

export async function updateClient(clientId: number, data: UpdateClientInput, user?: JwtPayload) {
  const tenantId = requireTenant(user);

  const existing = await clientRepository.findById(tenantId, clientId);
  if (!existing) throw new ClientNotFoundError('Cliente não encontrado');

  if ('responsavelInternoId' in data) {
    await assertResponsibleBelongsToTenant(tenantId, data.responsavelInternoId);
  }

  const updated = await clientRepository.update(tenantId, clientId, normalize(data));
  return { antes: existing, depois: updated };
}

export async function deleteClient(clientId: number, user?: JwtPayload) {
  const tenantId = requireTenant(user);
  const existing = await clientRepository.findById(tenantId, clientId);
  if (!existing) throw new ClientNotFoundError('Cliente não encontrado');
  await clientRepository.remove(tenantId, clientId);
  return existing;
}
