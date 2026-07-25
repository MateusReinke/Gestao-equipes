export type JwtPayload = {
  sub: string;
  userId: number;
  isGlobalAdmin: boolean;
  /** null quando o Administrador Global está no console da plataforma, sem tenant selecionado. */
  activeTenantId: number | null;
  /** papel do usuário dentro de activeTenantId; null quando activeTenantId é null. */
  role: 'admin' | 'gestor' | null;
};
