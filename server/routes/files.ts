import { Router } from 'express';
import AdmZip from 'adm-zip';

export const filesRouter = Router();

const MAX_CHARS_PER_FILE = 20_000;
const MAX_FILES_IN_ZIP = 60;

// Extensões que sabemos ser texto — o resto entra como "binário" (não lemos o conteúdo,
// só listamos o arquivo, pra não jogar lixo binário no contexto da IA).
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'csv', 'tsv', 'yml', 'yaml', 'xml', 'html', 'htm', 'css',
  'scss', 'less', 'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
  'hpp', 'cs', 'php', 'sh', 'bash', 'sql', 'env', 'gitignore', 'log', 'toml', 'ini', 'conf',
]);

function extOf(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

function truncate(content: string): { content: string; truncated: boolean } {
  if (content.length <= MAX_CHARS_PER_FILE) return { content, truncated: false };
  return { content: content.slice(0, MAX_CHARS_PER_FILE), truncated: true };
}

interface ExtractedFile {
  path: string;
  content: string;
  truncated: boolean;
  binary: boolean;
}

/** Recebe um arquivo (base64) e devolve o conteúdo pronto pra entrar no contexto da IA.
 *  Se for .zip, extrai e devolve uma entrada por arquivo interno (texto lido, binário só listado). */
filesRouter.post('/files/extract', (req, res) => {
  const { name, base64 } = req.body as { name?: string; base64?: string };
  if (!name || !base64) return res.status(400).json({ error: 'Envie "name" e "base64".' });

  try {
    const buffer = Buffer.from(base64, 'base64');
    const isZip = extOf(name) === 'zip';

    if (isZip) {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries().filter((e) => !e.isDirectory).slice(0, MAX_FILES_IN_ZIP);
      const files: ExtractedFile[] = entries.map((entry) => {
        const ext = extOf(entry.entryName);
        if (!TEXT_EXTENSIONS.has(ext)) {
          return { path: entry.entryName, content: '', truncated: false, binary: true };
        }
        const raw = entry.getData().toString('utf-8');
        const { content, truncated } = truncate(raw);
        return { path: entry.entryName, content, truncated, binary: false };
      });
      return res.json({ isZip: true, files, totalEntries: zip.getEntries().length });
    }

    const ext = extOf(name);
    if (!TEXT_EXTENSIONS.has(ext)) {
      return res.json({ isZip: false, files: [{ path: name, content: '', truncated: false, binary: true }] });
    }
    const raw = buffer.toString('utf-8');
    const { content, truncated } = truncate(raw);
    res.json({ isZip: false, files: [{ path: name, content, truncated, binary: false }] });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Falha ao ler o arquivo (verifique se não está corrompido).' });
  }
});
