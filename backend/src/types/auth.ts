export type JwtPayload = {
  sub: string;
  userId: number;
  isGlobalAdmin: boolean;
  /** null quando o Administrador Global está no console da plataforma, sem tenant selecionado. */
  activeTenantId: number | null;
  /** código do papel dentro de activeTenantId; null quando não há tenant ativo. */
  roleCodigo: string | null;
};
