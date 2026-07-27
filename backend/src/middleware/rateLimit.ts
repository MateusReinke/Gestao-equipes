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

/**
 * Rotas que saem para um serviço de terceiro por requisição.
 *
 * O teste de conexão do diretório chama o Entra ID a cada clique, e a Microsoft
 * mede a cota POR APLICAÇÃO — quem gastaria com um loop nesse botão é o tenant
 * do cliente, não a nossa API. O teto geral de 300/min é folgado demais para
 * isso; dez tentativas por minuto sobram para configurar uma App Registration
 * e não chegam perto de arranhar o limite do provedor.
 */
export const externalCallRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: mensagem('Muitos testes seguidos. Aguarde um minuto — o provedor de identidade também limita as tentativas.'),
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
