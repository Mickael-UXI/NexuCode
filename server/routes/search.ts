import { Router } from 'express';
import { env } from '../lib/env.js';
import { aiRateLimiter } from '../lib/rateLimiter.js';

export const searchRouter = Router();

// Mesmo rate limit das rotas de IA — busca profunda também consome cota da Tavily.
searchRouter.use('/search', aiRateLimiter);

/** Deep search: usa a API da Tavily (feita pra IA) pra buscar e já devolver resumos das páginas. */
searchRouter.post('/search', async (req, res) => {
  const { query } = req.body as { query: string };
  if (!query) return res.status(400).json({ error: 'Informe "query".' });

  if (!env.TAVILY_API_KEY) {
    return res.status(400).json({
      error: 'TAVILY_API_KEY não configurada no .env — a busca profunda fica desativada até você adicionar uma chave (tavily.com).',
    });
  }

  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        max_results: 6,
        include_answer: true,
      }),
    });
    if (!r.ok) throw new Error(`Tavily retornou ${r.status}`);
    const data = (await r.json()) as any;
    res.json({
      answer: data.answer ?? null,
      results: (data.results ?? []).map((x: any) => ({
        title: x.title,
        url: x.url,
        content: x.content,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao buscar.' });
  }
});
