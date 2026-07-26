import { Request, Response } from 'express';
import {
  lookupCnpj,
  lookupCep,
  InvalidDocumentError,
  LookupNotFoundError,
  LookupUnavailableError,
} from '../services/lookup.service';

function handleError(error: unknown, res: Response) {
  if (error instanceof InvalidDocumentError) return res.status(400).json({ error: error.message });
  if (error instanceof LookupNotFoundError) return res.status(404).json({ error: error.message });
  if (error instanceof LookupUnavailableError) return res.status(503).json({ error: error.message });
  throw error;
}

export const lookupController = {
  async cnpj(req: Request, res: Response) {
    try {
      const data = await lookupCnpj(String(req.params.cnpj));
      return res.json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async cep(req: Request, res: Response) {
    try {
      const data = await lookupCep(String(req.params.cep));
      return res.json(data);
    } catch (error) {
      return handleError(error, res);
    }
  },
};
