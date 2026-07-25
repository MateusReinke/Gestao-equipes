import { Request, Response } from 'express';
import { login, InvalidCredentialsError } from '../services/auth.service';

export const authController = {
  async login(req: Request, res: Response) {
    const { email, senha } = req.body;
    try {
      const result = await login(email, senha);
      return res.json(result);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        return res.status(401).json({ error: error.message });
      }
      throw error;
    }
  },
};
