export type SessionUser = { id: number; nome: string; email: string; isGlobalAdmin: boolean };
export type SessionTenant = { id: number; nome: string; slug: string };
export type SessionInfo = {
  token: string;
  user: SessionUser;
  tenant: SessionTenant | null;
  role: 'admin' | 'gestor' | null;
  activeTenantId: number | null;
};
