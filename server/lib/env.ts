import 'dotenv/config';

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export const env = {
  PORT: Number(process.env.PORT || 8787),

  // Supabase (server-side, usa a service role — NUNCA expor no cliente)
  SUPABASE_URL: optional('SUPABASE_URL') || optional('VITE_SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: optional('SUPABASE_SERVICE_ROLE_KEY'),

  // Provedores de IA — adicione as chaves que quiser habilitar
  ANTHROPIC_API_KEY: optional('ANTHROPIC_API_KEY'),
  OPENAI_API_KEY: optional('OPENAI_API_KEY'),
  GEMINI_API_KEY: optional('GEMINI_API_KEY'),
  GROQ_API_KEY: optional('GROQ_API_KEY'),
  DEEPSEEK_API_KEY: optional('DEEPSEEK_API_KEY'),
  // NVIDIA NIM (catálogo com os modelos Nemotron) — https://build.nvidia.com
  NVIDIA_API_KEY: optional('NVIDIA_API_KEY'),

  // Busca profunda (deep search)
  TAVILY_API_KEY: optional('TAVILY_API_KEY'),

  // GitHub (Personal Access Token com escopo "repo")
  GITHUB_TOKEN: optional('GITHUB_TOKEN'),
  GITHUB_DEFAULT_OWNER: optional('GITHUB_DEFAULT_OWNER'),
  GITHUB_DEFAULT_REPO: optional('GITHUB_DEFAULT_REPO'),

  // Stripe
  STRIPE_SECRET_KEY: optional('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: optional('STRIPE_WEBHOOK_SECRET'),
  STRIPE_PRICE_MONTHLY: optional('STRIPE_PRICE_MONTHLY'),
  STRIPE_PRICE_YEARLY: optional('STRIPE_PRICE_YEARLY'),
  APP_BASE_URL: optional('APP_BASE_URL') || 'http://localhost:5173',

  // Login admin (separado do login normal de usuários)
  ADMIN_EMAIL: optional('ADMIN_EMAIL'),
  ADMIN_PASSWORD_HASH: optional('ADMIN_PASSWORD_HASH'),
  ADMIN_JWT_SECRET: optional('ADMIN_JWT_SECRET') || 'change-me-in-.env-ADMIN_JWT_SECRET',

  // Limite diário de mensagens do plano free (monetização) — usuários "pro" e admin não têm limite.
  FREE_DAILY_MESSAGE_LIMIT: Number(process.env.FREE_DAILY_MESSAGE_LIMIT || 30),

  // Rate limiting das rotas de IA (proteção contra abuso/estouro de custo)
  AI_RATE_LIMIT_WINDOW_MS: Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 60_000),
  AI_RATE_LIMIT_MAX: Number(process.env.AI_RATE_LIMIT_MAX || 20),

  // Sandbox de execução de código (Piston — https://github.com/engineer-man/piston)
  PISTON_API_URL: optional('PISTON_API_URL') || 'https://emkc.org/api/v2/piston',
};

export function hasProvider(id: 'anthropic' | 'openai' | 'gemini' | 'groq' | 'deepseek' | 'nvidia') {
  switch (id) {
    case 'anthropic': return !!env.ANTHROPIC_API_KEY;
    case 'openai': return !!env.OPENAI_API_KEY;
    case 'gemini': return !!env.GEMINI_API_KEY;
    case 'groq': return !!env.GROQ_API_KEY;
    case 'deepseek': return !!env.DEEPSEEK_API_KEY;
    case 'nvidia': return !!env.NVIDIA_API_KEY;
  }
}
