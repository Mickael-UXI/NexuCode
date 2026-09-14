import { Router } from 'express';
import { env } from '../lib/env.js';
import { sandboxRateLimiter } from '../lib/rateLimiter.js';

export const sandboxRouter = Router();

/**
 * Executa código de verdade, isolado, sem depender de Docker/VM nossa —
 * importante porque o deploy deste projeto é serverless (Vercel/Netlify:
 * ver vercel.json e netlify.toml), onde não dá pra subir contêineres.
 * Usamos a API pública do Piston (https://github.com/engineer-man/piston),
 * o mesmo motor por trás do replit-antigo e de vários bots de execução de
 * código. Ela já isola o processo, limita tempo/memória e não tem acesso à
 * nossa infra. A instância pública (emkc.org) tem rate limit próprio — para
 * uso em produção com volume alto, o recomendado é rodar sua própria
 * instância do Piston (é só um contêiner Docker) e apontar PISTON_API_URL
 * pra ela no .env.
 */

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  py3: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  cs: 'csharp',
  kt: 'kotlin',
  rs: 'rust',
  go: 'go',
  golang: 'go',
};

const FILE_EXTENSION_BY_LANGUAGE: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  ruby: 'rb',
  bash: 'sh',
  php: 'php',
  java: 'java',
  csharp: 'cs',
  kotlin: 'kt',
  rust: 'rs',
  go: 'go',
  c: 'c',
  'c++': 'cpp',
  cpp: 'cpp',
};

function normalizeLanguage(input: string): string {
  const lower = input.trim().toLowerCase();
  return LANGUAGE_ALIASES[lower] || lower;
}

sandboxRouter.use('/sandbox', sandboxRateLimiter);

/** Lista as linguagens/versões suportadas pela instância do Piston configurada — útil pro front saber o que pode rodar. */
sandboxRouter.get('/sandbox/runtimes', async (_req, res) => {
  try {
    const r = await fetch(`${env.PISTON_API_URL}/runtimes`);
    if (!r.ok) throw new Error(`Piston retornou ${r.status}`);
    const data = await r.json();
    res.json({ runtimes: data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao listar linguagens suportadas.' });
  }
});

sandboxRouter.post('/sandbox/run', async (req, res) => {
  const { language, code, stdin } = req.body as { language?: string; code?: string; stdin?: string };

  if (!language || typeof language !== 'string') {
    return res.status(400).json({ error: 'Informe "language" (ex: javascript, python, bash).' });
  }
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Informe "code".' });
  }
  if (code.length > 60_000) {
    return res.status(400).json({ error: 'Código muito grande para executar no sandbox (limite: 60.000 caracteres).' });
  }

  const normalized = normalizeLanguage(language);
  const extension = FILE_EXTENSION_BY_LANGUAGE[normalized] || normalized;

  try {
    const r = await fetch(`${env.PISTON_API_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: normalized,
        version: '*',
        files: [{ name: `main.${extension}`, content: code }],
        stdin: stdin ?? '',
        // Limites de segurança extra além do que o Piston já aplica.
        run_timeout: 8000,
        compile_timeout: 10000,
      }),
    });

    const data = (await r.json().catch(() => null)) as any;

    if (!r.ok) {
      const message = data?.message || `Sandbox retornou ${r.status}`;
      return res.status(400).json({ error: message });
    }
    if (data?.message) {
      // Piston devolve { message: "..." } quando a linguagem/versão é inválida.
      return res.status(400).json({ error: data.message });
    }

    res.json({
      language: data.language,
      version: data.version,
      compile: data.compile
        ? { stdout: data.compile.stdout, stderr: data.compile.stderr, code: data.compile.code }
        : null,
      run: { stdout: data.run?.stdout ?? '', stderr: data.run?.stderr ?? '', code: data.run?.code ?? null },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao executar código no sandbox.' });
  }
});
