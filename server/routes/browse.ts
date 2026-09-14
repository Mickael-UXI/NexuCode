import { Router } from 'express';
import * as cheerio from 'cheerio';

export const browseRouter = Router();

/**
 * "Navegação no navegador": aqui é implementada como leitura server-side de uma
 * página pública (fetch + extração de texto). Não controla o navegador local do
 * usuário — isso exigiria uma extensão de navegador à parte (fora deste escopo).
 *
 * "Autoheal" da navegação: várias páginas bloqueiam requisições que parecem vir
 * de um bot (403/429), demoram a responder, ou têm redirecionamentos em cadeia.
 * Em vez de falhar na primeira tentativa, a rota se auto-corrige tentando de novo
 * com estratégias diferentes (outro User-Agent, mais tempo de timeout) antes de
 * desistir e devolver um erro claro pro usuário.
 */

/** User-Agents tentados em ordem. O primeiro imita um navegador comum (o que já
 *  resolve a maioria dos bloqueios simples); o segundo imita um crawler conhecido
 *  (alguns sites liberam explicitamente para indexadores, mesmo bloqueando bots
 *  genéricos); o terceiro é um fallback minimalista. */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; NexusAgent/1.0; +https://nexucode.dev)',
];

/** Tags que nunca carregam conteúdo útil pra leitura (código, estilo, navegação,
 *  formulários, mídia embutida) — removidas antes de qualquer extração. */
const JUNK_SELECTORS = 'script, style, noscript, svg, iframe, form, nav, header, footer, aside, button, input, textarea, [aria-hidden="true"]';

/** Seletores tentados em ordem de prioridade pra achar o "conteúdo principal" da
 *  página, no espírito de uma extração tipo Readability — sem precisar de uma
 *  biblioteca extra. Cai pro <body> inteiro se nenhum bater ou vier vazio demais. */
const CONTENT_SELECTORS = ['article', 'main', '[role="main"]', '#content', '.content', '.post', '.article'];

interface FetchAttempt {
  userAgent: string;
  timeoutMs: number;
}

const ATTEMPTS: FetchAttempt[] = [
  { userAgent: USER_AGENTS[0], timeoutMs: 8_000 },
  { userAgent: USER_AGENTS[1], timeoutMs: 12_000 },
  { userAgent: USER_AGENTS[2], timeoutMs: 15_000 },
];

function cleanText(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Escolhe o melhor bloco de conteúdo da página: tenta os seletores "prováveis"
 *  primeiro, e usa o texto mais longo entre eles; só cai pro body todo se nada
 *  específico tiver um mínimo de conteúdo (evita pegar um <article> vazio de
 *  esqueleto/skeleton loading). */
function extractMainText($: cheerio.CheerioAPI): string {
  $(JUNK_SELECTORS).remove();

  let best = '';
  for (const selector of CONTENT_SELECTORS) {
    const text = cleanText($(selector).first().text());
    if (text.length > best.length) best = text;
  }

  if (best.length < 200) {
    const bodyText = cleanText($('body').text());
    if (bodyText.length > best.length) best = bodyText;
  }

  return best;
}

function extractTitle($: cheerio.CheerioAPI): string {
  const title = $('title').first().text().trim();
  if (title) return title;
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle) return ogTitle.trim();
  return '';
}

async function fetchWithTimeout(url: string, userAgent: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Sabe quando vale a pena tentar de novo com outra estratégia: erros de rede,
 *  timeout, e respostas que indicam bloqueio/instabilidade temporária do lado do
 *  servidor (403, 429, 5xx). Erros "definitivos" (404, URL inválida) não se
 *  beneficiam de retry — falha rápido nesses casos. */
function isRetryableStatus(status: number): boolean {
  return status === 403 || status === 408 || status === 429 || status >= 500;
}

browseRouter.post('/browse', async (req, res) => {
  const { url } = req.body as { url: string };
  if (!url) return res.status(400).json({ error: 'Informe "url".' });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'URL inválida.' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Apenas URLs http/https são permitidas.' });
  }

  const target = parsed.toString();
  let lastError: string | null = null;
  let lastStatus: number | null = null;

  for (let i = 0; i < ATTEMPTS.length; i++) {
    const { userAgent, timeoutMs } = ATTEMPTS[i];
    const isLastAttempt = i === ATTEMPTS.length - 1;

    try {
      const r = await fetchWithTimeout(target, userAgent, timeoutMs);

      if (!r.ok) {
        lastStatus = r.status;
        lastError = `A página respondeu com status ${r.status}.`;
        // Erro "definitivo" (ex.: 404) — não adianta trocar de User-Agent, desiste já.
        if (!isRetryableStatus(r.status) || isLastAttempt) {
          return res.status(502).json({
            error: `Não consegui acessar a página (status ${r.status}) mesmo após ${i + 1} tentativa(s).`,
          });
        }
        continue; // tenta a próxima estratégia (outro User-Agent / mais tempo)
      }

      const contentType = r.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        return res.status(415).json({
          error: `A URL não devolveu uma página HTML (content-type: ${contentType || 'desconhecido'}).`,
        });
      }

      const html = await r.text();
      const $ = cheerio.load(html);
      const title = extractTitle($);
      const text = extractMainText($);

      if (!text) {
        lastError = 'A página respondeu, mas não encontrei nenhum texto legível nela (pode depender de JavaScript para carregar o conteúdo).';
        if (isLastAttempt) {
          return res.status(422).json({ error: lastError });
        }
        continue;
      }

      return res.json({
        title,
        url: r.url || target,
        text: text.slice(0, 12000),
        attempts: i + 1,
      });
    } catch (err: any) {
      lastError = err?.name === 'AbortError' ? `Tempo limite (${timeoutMs / 1000}s) excedido.` : err?.message || 'Falha de rede.';
      if (isLastAttempt) {
        return res.status(502).json({
          error: `Falha ao acessar a página após ${ATTEMPTS.length} tentativas (auto-retry): ${lastError}`,
        });
      }
      // Rede instável / timeout — tenta de novo com a próxima estratégia.
      continue;
    }
  }

  // Só chega aqui em teoria (o loop sempre retorna ou lança antes) — guarda de segurança.
  res.status(502).json({ error: lastError || `Não foi possível acessar a página (status ${lastStatus ?? 'desconhecido'}).` });
});
