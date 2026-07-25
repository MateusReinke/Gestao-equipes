import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { userRepository } from '../repositories/user.repository';

export class InvalidCredentialsError extends Error {}

export async function login(email: string, senha: string) {
  const user = await userRepository.findByEmail(email);
  if (!user || !user.ativo) throw new InvalidCredentialsError('Credenciais inválidas');

  const valid = await bcrypt.compare(String(senha || ''), user.senhaHash);
  if (!valid) throw new InvalidCredentialsError('Credenciais inválidas');

  const token = jwt.sign({ sub: user.email, userId: user.id, role: user.role }, env.jwtSecret, { expiresIn: '12h' });
  return { token, user: { id: user.id, nome: user.nome, email: user.email, role: user.role } };
}
