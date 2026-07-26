export type UserRole = 'admin' | 'gestor' | 'rh' | 'monitoramento' | 'cliente';

export type JwtPayload = {
  sub: string;
  userId: number;
  role: UserRole;
  clienteId?: number | null;
};
