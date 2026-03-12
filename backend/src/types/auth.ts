export type JwtPayload = {
  sub: string;
  role: 'admin' | 'gestor' | 'viewer';
};
