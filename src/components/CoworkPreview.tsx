import { useEffect, useMemo, useState } from 'react';
import { RotateCw, ExternalLink, TriangleAlert, Loader2 } from 'lucide-react';
import type { ProjectFile } from '@/lib/api';
import { buildStaticPreviewDocument, buildReactPreviewDocument } from '@/lib/preview';
import { detectReactEntry, buildReactPreview, buildImportMap } from '@/lib/reactPreview';

interface RuntimeError {
  message: string;
  source?: string;
  line?: number;
  col?: number;
}

/** Preview ao vivo do projeto dentro do split screen do Cowork (item 6 do backlog).
 *  Dois caminhos, escolhidos automaticamente pelos arquivos do projeto:
 *  - Site estático (tem index.html na raiz): inlina CSS/JS locais direto num iframe.
 *  - App React/Vite (tem src/main.tsx e afins): builda tudo no navegador via
 *    esbuild-wasm (reactPreview.ts) e resolve as libs externas (react, etc.) via
 *    import map apontando pro esm.sh — sem servidor, sem `npm install`. */
export default function CoworkPreview({ files }: { files: ProjectFile[] }) {
  const [runtimeError, setRuntimeError] = useState<RuntimeError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [reactBuild, setReactBuild] = useState<{ html: string | null; error: string | null; building: boolean }>({
    html: null,
    error: null,
    building: false,
  });

  // Debounce: só recompila 500ms depois da última mudança de arquivo, pra não rebuildar
  // a cada caractere enquanto a IA está streamando ou o usuário edita manualmente.
  const [debouncedFiles, setDebouncedFiles] = useState(files);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFiles(files), 500);
    return () => clearTimeout(t);
  }, [files]);

  const reactEntry = useMemo(() => detectReactEntry(debouncedFiles), [debouncedFiles]);
  const staticResult = useMemo(
    () => (reactEntry ? { html: null, entry: null } : buildStaticPreviewDocument(debouncedFiles)),
    [debouncedFiles, reactEntry]
  );

  useEffect(() => {
    if (!reactEntry) {
      setReactBuild({ html: null, error: null, building: false });
      return;
    }
    let cancelled = false;
    setReactBuild((b) => ({ ...b, building: true, error: null }));
    buildReactPreview(debouncedFiles, reactEntry).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setReactBuild({ html: null, error: result.error ?? 'Erro desconhecido ao compilar.', building: false });
        return;
      }
      const importMap = buildImportMap(result.externals ?? [], debouncedFiles);
      const html = buildReactPreviewDocument(result.code ?? '', result.css ?? '', importMap);
      setReactBuild({ html, error: null, building: false });
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedFiles, reactEntry]);

  const html = reactEntry ? reactBuild.html : staticResult.html;
  const entryLabel = reactEntry ?? staticResult.entry;

  useEffect(() => setRuntimeError(null), [html]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data && e.data.__nexuPreviewError) {
        setRuntimeError({ message: e.data.message, source: e.data.source, line: e.data.line, col: e.data.col });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const openInNewTab = () => {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  if (reactEntry && reactBuild.building && !reactBuild.html) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-text-faint p-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Compilando o projeto React no navegador (a primeira vez pode demorar alguns segundos)...
      </div>
    );
  }

  if (reactEntry && reactBuild.error) {
    return (
      <div className="flex-1 p-3 overflow-auto">
        <div className="rounded-lg border border-red-400/40 bg-red-950/90 text-red-100 text-[11px] font-mono p-3 whitespace-pre-wrap">
          <div className="flex items-center gap-1.5 mb-1.5 text-red-300 font-sans text-xs">
            <TriangleAlert className="w-3.5 h-3.5 flex-shrink-0" />
            Falha ao compilar o preview React
          </div>
          {reactBuild.error}
        </div>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-text-faint p-6 text-center leading-relaxed">
        Ainda não encontrei um <code className="font-mono">index.html</code> nem um entrypoint React
        (<code className="font-mono">src/main.tsx</code>) neste projeto — o preview aparece assim que a IA
        gerar um desses.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border text-xs text-text-faint flex-shrink-0">
        <span className="truncate font-mono flex items-center gap-1.5">
          {entryLabel}
          {reactEntry && reactBuild.building && <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            title="Recarregar preview"
            className="p-1.5 rounded-md hover:bg-surface-2 hover:text-text-main transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={openInNewTab}
            title="Abrir em nova aba"
            className="p-1.5 rounded-md hover:bg-surface-2 hover:text-text-main transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 relative bg-white">
        <iframe
          key={reloadKey}
          title="Preview"
          srcDoc={html}
          sandbox="allow-scripts allow-modals allow-forms allow-popups"
          className="w-full h-full border-0"
        />
        {runtimeError && (
          <div className="absolute inset-x-2 bottom-2 rounded-lg border border-red-400/40 bg-red-950/90 text-red-100 text-[11px] font-mono p-2.5 shadow-lg max-h-40 overflow-auto">
            <div className="flex items-center gap-1.5 mb-1 text-red-300">
              <TriangleAlert className="w-3.5 h-3.5 flex-shrink-0" />
              Erro no preview
            </div>
            <div className="whitespace-pre-wrap">
              {runtimeError.message}
              {runtimeError.source ? `\n${runtimeError.source}${runtimeError.line ? `:${runtimeError.line}:${runtimeError.col ?? 0}` : ''}` : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
