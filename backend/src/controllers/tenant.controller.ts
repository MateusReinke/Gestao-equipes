import { Request, Response } from 'express';
import { listTenants, createTenant, createTenantSchema, DuplicateSlugError } from '../services/tenant.service';

export const tenantController = {
  async list(_req: Request, res: Response) {
    const data = await listTenants();
    return res.json(data);
  },

  async create(req: Request, res: Response) {
    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    try {
      const tenant = await createTenant(parsed.data);
      return res.status(201).json(tenant);
    } catch (error) {
      if (error instanceof DuplicateSlugError) return res.status(409).json({ error: error.message });
      throw error;
    }
  },
};
