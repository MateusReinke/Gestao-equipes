import { prisma } from '../config/prisma';

export const tenantRepository = {
  findAll() {
    return prisma.tenant.findMany({ orderBy: { nome: 'asc' } });
  },
  findById(id: number) {
    return prisma.tenant.findUnique({ where: { id } });
  },
  findBySlug(slug: string) {
    return prisma.tenant.findUnique({ where: { slug } });
  },
  create(data: { nome: string; slug: string }) {
    return prisma.tenant.create({ data });
  },
};
