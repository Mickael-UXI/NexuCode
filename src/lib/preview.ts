import type { ProjectFile } from '@/lib/api';

/** Injetado no <head> do documento de preview: captura erros de runtime (síncronos e
 *  promises rejeitadas) e manda pro componente pai via postMessage, pra virar o overlay
 *  de erro do painel de Preview (item 6 do backlog) em vez de só aparecer no console. */
export const ERROR_CAPTURE_SCRIPT = `
<script>
(function () {
  function send(payload) {
    try { window.parent.postMessage(Object.assign({ __nexuPreviewError: true }, payload), '*'); } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    send({ message: e.message, source: e.filename, line: e.lineno, col: e.colno });
  });
  window.addEventListener('unhandledrejection', function (e) {
    var reason = e.reason;
    var message = reason && reason.message ? reason.message : String(reason);
    send({ message: 'Promise rejeitada: ' + message });
  });
})();
</script>
`;

function isExternalRef(ref: string): boolean {
  return /^([a-z]+:)?\/\//i.test(ref) || ref.startsWith('data:');
}

/** Resolve um caminho relativo (de um href/src dentro do HTML) contra o caminho do
 *  arquivo HTML de origem, pra bater com as chaves salvas em `files` (que usam o
 *  caminho completo dentro do projeto, ex.: "src/style.css"). */
function resolveLocalPath(fromFile: string, ref: string): string {
  const clean = ref.split('#')[0].split('?')[0].replace(/^\.\//, '');
  if (clean.startsWith('/')) return clean.slice(1);
  const baseDir = fromFile.includes('/') ? fromFile.slice(0, fromFile.lastIndexOf('/') + 1) : '';
  const parts = (baseDir + clean).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/** Monta um único HTML "auto-contido" a partir de um projeto estático (HTML/CSS/JS puro):
 *  acha o index.html, inlina <link rel="stylesheet"> e <script src> que apontem pra
 *  arquivos do próprio projeto (CDNs/URLs externas ficam como estão) e injeta a captura
 *  de erro. Não faz bundling de import/require — não substitui um bundler de verdade
 *  pra projetos React/Vite, só cobre o caso "front-end estático" citado no critério de
 *  aceite do item 6. */
export function buildStaticPreviewDocument(files: ProjectFile[]): { html: string | null; entry: string | null } {
  const byPath = new Map(files.map((f) => [f.path.replace(/^\.?\//, ''), f]));
  const keys = [...byPath.keys()];
  const entry =
    keys.find((p) => p.toLowerCase() === 'index.html') ??
    keys.find((p) => p.toLowerCase().endsWith('/index.html')) ??
    keys.find((p) => p.toLowerCase().endsWith('.html'));
  if (!entry) return { html: null, entry: null };

  let html = byPath.get(entry)!.content;

  html = html.replace(/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch || isExternalRef(hrefMatch[1])) return tag;
    const file = byPath.get(resolveLocalPath(entry, hrefMatch[1]));
    return file ? `<style>\n${file.content}\n</style>` : tag;
  });

  html = html.replace(/<script\s+([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi, (tag, before, src, after) => {
    if (isExternalRef(src)) return tag;
    const file = byPath.get(resolveLocalPath(entry, src));
    if (!file) return tag;
    const isModule = /type=["']module["']/i.test(`${before}${after}`);
    return `<script${isModule ? ' type="module"' : ''}>\n${file.content}\n</script>`;
  });

  html = html.includes('<head>') ? html.replace('<head>', `<head>${ERROR_CAPTURE_SCRIPT}`) : ERROR_CAPTURE_SCRIPT + html;

  return { html, entry };
}

/** Monta o documento final do preview de um app React já buildado (ver
 *  reactPreview.ts): injeta o import map que resolve as dependências externas via
 *  esm.sh, o CSS global extraído dos `import './x.css'`, e o bundle ESM num
 *  `<script type="module">` que monta na `<div id="root">`. */
export function buildReactPreviewDocument(code: string, css: string, importMap: Record<string, string>): string {
  // Escapa "</script>"/"</style>" literais que possam existir dentro do código ou CSS
  // (ex.: dentro de uma string JSX) — sem isso, o parser de HTML fecharia a tag mais cedo.
  const safeCode = code.replace(/<\/script/gi, '<\\/script');
  const safeCss = css.replace(/<\/style/gi, '<\\/style');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>html, body, #root { height: 100%; margin: 0; }
${safeCss}</style>
<script type="importmap">${JSON.stringify({ imports: importMap })}</script>
${ERROR_CAPTURE_SCRIPT}
</head>
<body>
<div id="root"></div>
<script type="module">
${safeCode}
</script>
</body>
</html>`;
}
