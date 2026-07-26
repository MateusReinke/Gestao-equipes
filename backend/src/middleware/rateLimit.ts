import rateLimit from 'express-rate-limit';

/**
 * Limites de requisição.
 *
 * A chave é o IP, então o `trust proxy` do app precisa estar correto — atrás do
 * Coolify/nginx, sem isso todo mundo compartilharia o IP do proxy e um único
 * usuário barulhento derrubaria os demais.
 */

const mensagem = (texto: string) => ({ error: texto });

/// Login é o alvo natural de força bruta: janela curta, teto baixo.
/// Só conta tentativa que falhou — quem acerta a senha não gasta cota.
export const loginRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: mensagem('Muitas tentativas de login. Aguarde alguns minutos e tente de novo.'),
});

/// O token do wallboard é um segredo de 32 caracteres na URL. O limite existe
/// para que ninguém tente adivinhá-lo por tentativa e erro.
export const publicRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: mensagem('Muitas requisições. Aguarde um instante.'),
});

/// Teto geral da API autenticada. Folgado o bastante para não incomodar o uso
/// normal (a tela dispara várias chamadas por página), apertado o bastante para
/// conter varredura automatizada.
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: mensagem('Muitas requisições. Aguarde um instante.'),
});
