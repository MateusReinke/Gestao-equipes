import { Request, Response } from 'express';
import {
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  createTenantSchema,
  updateTenantSchema,
  DuplicateSlugError,
  TenantNotFoundError,
  TenantHasDataError,
} from '../services/tenant.service';

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

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const parsed = updateTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', issues: parsed.error.flatten().fieldErrors });
    }

    try {
      const tenant = await updateTenant(id, parsed.data);
      return res.json(tenant);
    } catch (error) {
      if (error instanceof TenantNotFoundError) return res.status(404).json({ error: error.message });
      if (error instanceof DuplicateSlugError) return res.status(409).json({ error: error.message });
      throw error;
    }
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    try {
      await deleteTenant(id);
      return res.status(204).send();
    } catch (error) {
      if (error instanceof TenantNotFoundError) return res.status(404).json({ error: error.message });
      if (error instanceof TenantHasDataError) return res.status(409).json({ error: error.message });
      throw error;
    }
  },
};
