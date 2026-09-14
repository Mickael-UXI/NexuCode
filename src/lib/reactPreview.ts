import type { ProjectFile } from '@/lib/api';

// Import dinâmico: o pacote é pesado (~2MB de wasm) — só carrega quando o preview
// realmente precisa dele (projeto React), nunca no bundle inicial do app.
type EsbuildModule = typeof import('esbuild-wasm');
let esbuildReady: Promise<EsbuildModule> | null = null;

async function getEsbuild(): Promise<EsbuildModule> {
  if (!esbuildReady) {
    esbuildReady = (async () => {
      const esbuild = await import('esbuild-wasm');
      // A versão do .wasm precisa bater exatamente com a versão do pacote JS instalado —
      // por isso usamos `esbuild.version` (exportado pelo próprio pacote) em vez de fixar
      // um número, senão `initialize` rejeita com "version mismatch".
      await esbuild.initialize({ wasmURL: `https://unpkg.com/esbuild-wasm@${esbuild.version}/esbuild.wasm` });
      return esbuild;
    })();
  }
  return esbuildReady;
}

function normalize(p: string): string {
  return p.replace(/^\.\//, '').replace(/^\//, '');
}

function resolveRelative(fromFile: string, ref: string): string {
  const baseDir = fromFile.includes('/') ? fromFile.slice(0, fromFile.lastIndexOf('/') + 1) : '';
  const parts = (baseDir + ref).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

// Tentado nessa ordem ao resolver um import sem extensão explícita — cobre tanto
// "./App" -> "App.tsx" quanto "./components" -> "components/index.tsx".
const RESOLVABLE_SUFFIXES = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];

const ENTRY_CANDIDATES = [
  'src/main.tsx', 'src/main.jsx', 'src/main.ts', 'src/main.js',
  'src/index.tsx', 'src/index.jsx',
  'main.tsx', 'main.jsx',
  'index.tsx', 'index.jsx',
];

/** Detecta se o projeto é um app React (Vite/CRA — tem um entrypoint típico como
 *  src/main.tsx) em vez de um site estático HTML/CSS/JS puro. Retorna o caminho do
 *  entrypoint encontrado, ou null. */
export function detectReactEntry(files: ProjectFile[]): string | null {
  const byPath = new Set(files.map((f) => normalize(f.path)));
  return ENTRY_CANDIDATES.find((c) => byPath.has(c)) ?? null;
}

export interface ReactBuildResult {
  ok: boolean;
  code?: string;
  css?: string;
  externals?: string[];
  error?: string;
}

/** Builda o projeto inteiro (todos os imports relativos entre os arquivos do usuário)
 *  em memória, via esbuild-wasm — sem tocar disco, sem servidor. Dependências de
 *  terceiros (react, react-dom, qualquer lib de npm) NÃO são bundladas: ficam marcadas
 *  "external" e são resolvidas depois por um import map apontando pro esm.sh (ver
 *  buildImportMap), porque baixar/resolver a árvore de node_modules de verdade no
 *  navegador está fora do escopo de um preview. CSS importado via `import './x.css'`
 *  é extraído à parte (virou <style> global) em vez de injetado no JS. */
export async function buildReactPreview(files: ProjectFile[], entry: string): Promise<ReactBuildResult> {
  const esbuild = await getEsbuild();
  const byPath = new Map(files.map((f) => [normalize(f.path), f]));
  const externals = new Set<string>();
  let css = '';

  const findFile = (path: string): { path: string; content: string } | null => {
    for (const suffix of RESOLVABLE_SUFFIXES) {
      const candidate = path + suffix;
      const file = byPath.get(candidate);
      if (file) return { path: candidate, content: file.content };
    }
    return null;
  };

  try {
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: 'esm',
      jsx: 'automatic',
      logLevel: 'silent',
      plugins: [
        {
          name: 'nexu-virtual-fs',
          setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
              if (args.kind === 'entry-point') {
                const found = findFile(normalize(args.path));
                return found ? { path: found.path, namespace: 'nexu-vfs' } : { errors: [{ text: `Entrypoint não encontrado: ${args.path}` }] };
              }
              const isRelative = args.path.startsWith('.') || args.path.startsWith('/');
              if (!isRelative) {
                // Dependência de npm (react, alguma lib, etc.) — resolvida depois via CDN.
                externals.add(args.path);
                return { path: args.path, external: true };
              }
              const resolved = resolveRelative(args.importer, args.path);
              const found = findFile(resolved);
              if (!found) {
                return { errors: [{ text: `Arquivo não encontrado no projeto: "${args.path}" (importado por ${args.importer})` }] };
              }
              return { path: found.path, namespace: 'nexu-vfs' };
            });

            build.onLoad({ filter: /.*/, namespace: 'nexu-vfs' }, (args) => {
              const file = byPath.get(args.path);
              if (!file) return { errors: [{ text: `Arquivo não encontrado: ${args.path}` }] };
              const ext = args.path.split('.').pop() ?? '';
              if (ext === 'css') {
                css += `\n${file.content}`;
                return { contents: '', loader: 'js' };
              }
              const loader = (['tsx', 'ts', 'jsx', 'js', 'json'] as const).includes(ext as any)
                ? (ext as 'tsx' | 'ts' | 'jsx' | 'js' | 'json')
                : 'text';
              return { contents: file.content, loader };
            });
          },
        },
      ],
    });

    return { ok: true, code: result.outputFiles?.[0]?.text ?? '', css, externals: [...externals] };
  } catch (err: any) {
    const message: string =
      err?.errors?.map((e: any) => `${e.text}${e.location ? ` (${e.location.file}:${e.location.line})` : ''}`).join('\n') ||
      err?.message ||
      'Falha ao compilar o projeto.';
    return { ok: false, error: message };
  }
}

function pkgVersionFor(files: ProjectFile[], pkgName: string): string | null {
  const pkgFile = files.find((f) => normalize(f.path) === 'package.json');
  if (!pkgFile) return null;
  try {
    const pkg = JSON.parse(pkgFile.content);
    const raw = pkg.dependencies?.[pkgName] ?? pkg.devDependencies?.[pkgName];
    return typeof raw === 'string' ? raw.replace(/^[\^~]/, '') : null;
  } catch {
    return null;
  }
}

/** Monta o import map que resolve cada dependência externa detectada pro esm.sh,
 *  usando a versão declarada no package.json do próprio projeto quando existir
 *  (senão o esm.sh serve a última versão estável). */
export function buildImportMap(externals: string[], files: ProjectFile[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const spec of externals) {
    const pkgName = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    const subpath = spec.slice(pkgName.length);
    const version = pkgVersionFor(files, pkgName);
    map[spec] = `https://esm.sh/${version ? `${pkgName}@${version}` : pkgName}${subpath}`;
  }
  return map;
}
