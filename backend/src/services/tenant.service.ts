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

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export class DuplicateSlugError extends Error {}

export async function listTenants() {
  return tenantRepository.findAll();
}

export async function createTenant(data: CreateTenantInput) {
  const existing = await tenantRepository.findBySlug(data.slug);
  if (existing) throw new DuplicateSlugError('Já existe um tenant com esse identificador');
  return tenantRepository.create(data);
}
