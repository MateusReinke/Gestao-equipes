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
  update(id: number, data: { nome?: string; slug?: string; ativo?: boolean }) {
    return prisma.tenant.update({ where: { id }, data });
  },
  remove(id: number) {
    return prisma.tenant.delete({ where: { id } });
  },
};
