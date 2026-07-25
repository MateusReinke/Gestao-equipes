import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { tenantRepository } from '../repositories/tenant.repository';

export const createTenantSchema = z.object({
  nome: z.string().trim().min(2, 'Nome da empresa é obrigatório'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen'),
});

export const updateTenantSchema = z.object({
  nome: z.string().trim().min(2, 'Nome da empresa é obrigatório').optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen')
    .optional(),
  ativo: z.boolean().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export class DuplicateSlugError extends Error {}
export class TenantNotFoundError extends Error {}
export class TenantHasDataError extends Error {}

export async function listTenants() {
  return tenantRepository.findAll();
}

export async function createTenant(data: CreateTenantInput) {
  const existing = await tenantRepository.findBySlug(data.slug);
  if (existing) throw new DuplicateSlugError('Já existe um tenant com esse identificador');
  return tenantRepository.create(data);
}

export async function updateTenant(id: number, data: UpdateTenantInput) {
  const tenant = await tenantRepository.findById(id);
  if (!tenant) throw new TenantNotFoundError('Tenant não encontrado');

  if (data.slug && data.slug !== tenant.slug) {
    const existing = await tenantRepository.findBySlug(data.slug);
    if (existing) throw new DuplicateSlugError('Já existe um tenant com esse identificador');
  }

  return tenantRepository.update(id, data);
}

export async function deleteTenant(id: number) {
  const tenant = await tenantRepository.findById(id);
  if (!tenant) throw new TenantNotFoundError('Tenant não encontrado');

  try {
    await tenantRepository.remove(id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new TenantHasDataError(
        'Não é possível remover uma empresa que já possui dados (usuários, equipes, clientes etc.). Desative-a em vez disso.'
      );
    }
    throw error;
  }
}
