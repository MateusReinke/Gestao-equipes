import { prisma } from '../config/prisma';

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  findByEmailWithMemberships(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { tenant: true } } },
    });
  },
};
