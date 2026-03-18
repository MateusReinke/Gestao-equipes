export type JwtPayload = {
  sub: string;
  userId: number;
  role: 'admin' | 'gestor';
};
