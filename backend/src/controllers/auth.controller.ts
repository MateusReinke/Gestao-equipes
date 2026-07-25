import { Request, Response } from 'express';
import {
  login,
  switchTenant,
  InvalidCredentialsError,
  NoTenantAccessError,
  TenantSelectionRequiredError,
} from '../services/auth.service';

export const authController = {
  async login(req: Request, res: Response) {
    const { email, senha, tenantId } = req.body;
    try {
      const result = await login(email, senha, tenantId != null ? Number(tenantId) : undefined);
      return res.json(result);
    } catch (error) {
      if (error instanceof TenantSelectionRequiredError) {
        return res.status(409).json({ error: error.message, requiresTenantSelection: true, tenants: error.tenants });
      }
      if (error instanceof NoTenantAccessError) {
        return res.status(403).json({ error: error.message });
      }
      if (error instanceof InvalidCredentialsError) {
        return res.status(401).json({ error: error.message });
      }
      throw error;
    }
  },

  async switchTenant(req: Request, res: Response) {
    const { tenantId } = req.body as { tenantId?: number | null };
    try {
      const result = await switchTenant(req.user!, tenantId ?? null);
      return res.json(result);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  },
};
