import { Router } from 'express';
import { Octokit } from '@octokit/rest';
import { env } from '../lib/env.js';

export const githubRouter = Router();

interface FileInput {
  path: string;
  content: string;
}

githubRouter.post('/github/push', async (req, res) => {
  if (!env.GITHUB_TOKEN) {
    return res.status(400).json({ error: 'GITHUB_TOKEN não configurado no .env (crie um token com escopo "repo").' });
  }

  const {
    owner = env.GITHUB_DEFAULT_OWNER,
    repo = env.GITHUB_DEFAULT_REPO,
    branch = 'main',
    message = 'Atualização via Nexus Cowork',
    files,
  } = req.body as { owner?: string; repo?: string; branch?: string; message?: string; files: FileInput[] };

  if (!owner || !repo) return res.status(400).json({ error: 'Informe "owner" e "repo" (ou configure defaults no .env).' });
  if (!Array.isArray(files) || files.length === 0) return res.status(400).json({ error: 'Envie ao menos um arquivo.' });

  const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
  const results: { path: string; ok: boolean; error?: string }[] = [];

  for (const file of files) {
    try {
      let sha: string | undefined;
      try {
        const existing = await octokit.repos.getContent({ owner, repo, path: file.path, ref: branch });
        if (!Array.isArray(existing.data) && existing.data.type === 'file') sha = existing.data.sha;
      } catch {
        /* arquivo ainda não existe — cria novo */
      }

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file.path,
        message,
        content: Buffer.from(file.content, 'utf-8').toString('base64'),
        branch,
        sha,
      });
      results.push({ path: file.path, ok: true });
    } catch (err: any) {
      results.push({ path: file.path, ok: false, error: err?.message });
    }
  }

  res.json({ results, repoUrl: `https://github.com/${owner}/${repo}` });
});
