import rateLimit from 'express-rate-limit';
import { env } from './env.js';

/**
 * Rate limit por IP nas rotas que chamam provedores de IA (chat/cowork,
 * busca profunda). Evita que alguém estoure a conta na API se o site ficar
 * público — cada instância do servidor mantém sua própria contagem em
 * memória, o que já é suficiente pra proteção básica em deploys de instância
 * única; para múltiplas instâncias, considere um store compartilhado (ex.
 * Redis) via a opção `store` do express-rate-limit.
 */
export const aiRateLimiter = rateLimit({
  windowMs: env.AI_RATE_LIMIT_WINDOW_MS,
  max: env.AI_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições em pouco tempo. Aguarde um instante e tente novamente.' },
});

/** Mais restritivo — execução de código no sandbox é mais cara/sensível que uma chamada de chat. */
export const sandboxRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas execuções em pouco tempo. Aguarde um instante e tente novamente.' },
});
