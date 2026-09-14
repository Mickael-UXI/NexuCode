import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileCode, Copy, Check, Download, Trash2, History, MessageSquare } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { Artifact, ArtifactVersion, listArtifacts, getArtifactVersions, deleteArtifact } from '@/lib/artifacts';
import { setLastConversationId } from '@/lib/localState';

interface ArtifactsProps {
  session: Session;
  onNavigate: (page: 'home' | 'chat' | 'cowork' | 'projects' | 'artifacts' | 'account') => void;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export default function Artifacts({ onNavigate }: ArtifactsProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Artifact | null>(null);
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [viewingVersion, setViewingVersion] = useState<ArtifactVersion | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    setArtifacts(await listArtifacts());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openArtifact = async (a: Artifact) => {
    setSelected(a);
    setViewingVersion(null);
    setVersions(await getArtifactVersions(a.id));
  };

  const handleDelete = async (a: Artifact, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Apagar o artefato "${a.title}"? Isso remove todo o histórico de versões dele.`)) return;
    if (await deleteArtifact(a.id)) {
      if (selected?.id === a.id) setSelected(null);
      load();
    }
  };

  const shownContent = viewingVersion ? viewingVersion.content : selected?.content ?? '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    if (!selected) return;
    const blob = new Blob([shownContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selected.title;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenOriginChat = () => {
    if (!selected) return;
    setLastConversationId(selected.mode, selected.conversation_id);
    onNavigate(selected.mode);
  };

  const grouped = useMemo(() => {
    const byConversation = new Map<string, Artifact[]>();
    for (const a of artifacts) {
      const list = byConversation.get(a.conversation_id) ?? [];
      list.push(a);
      byConversation.set(a.conversation_id, list);
    }
    return byConversation;
  }, [artifacts]);

  return (
    <div className="min-h-screen bg-bg text-text-main">
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => onNavigate('chat')}
            className="flex items-center gap-1.5 text-sm text-text-dim hover:text-text-main transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            Voltar
          </button>
          <span className="text-text-faint">/</span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <FileCode className="w-4 h-4" strokeWidth={1.5} />
            Artefatos
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid md:grid-cols-[320px_1fr] gap-6">
        {/* Lista de artefatos, agrupados por conversa de origem */}
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {loading ? (
            <p className="text-sm text-text-faint px-1">Carregando…</p>
          ) : artifacts.length === 0 ? (
            <p className="text-sm text-text-faint px-1">
              Nenhum artefato ainda. Peça um código, arquivo ou documento no Chat ou no Cowork — eles aparecem aqui
              automaticamente.
            </p>
          ) : (
            Array.from(grouped.entries()).map(([conversationId, items]) => (
              <div key={conversationId}>
                <p className="text-[11px] uppercase tracking-wider text-text-faint px-1 mb-1.5">
                  {items[0].mode === 'cowork' ? 'Projeto (Cowork)' : 'Conversa'}
                </p>
                <div className="space-y-1">
                  {items.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => openArtifact(a)}
                      className={`group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                        selected?.id === a.id ? 'bg-accent-bg text-accent' : 'hover:bg-surface-2 text-text-dim hover:text-text-main'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm truncate">{a.title}</span>
                        <span className="block text-[11px] text-text-faint">
                          v{a.version} · {timeAgo(a.updated_at)}
                        </span>
                      </span>
                      <span
                        onClick={(e) => handleDelete(a, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-text-faint hover:text-red-400 flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Visualizador do artefato selecionado */}
        <div className="min-h-[300px] rounded-xl border border-border bg-surface/40 flex flex-col">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-text-faint py-16">
              <FileCode className="w-8 h-8 mb-3" strokeWidth={1.2} />
              <p className="text-sm">Selecione um artefato à esquerda para visualizar.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border flex-wrap">
                <div className="min-w-0">
                  <h2 className="text-sm font-medium truncate">{selected.title}</h2>
                  <p className="text-[11px] text-text-faint">
                    {viewingVersion ? `Vendo v${viewingVersion.version} (histórico)` : `Versão atual · v${selected.version}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={handleOpenOriginChat}
                    title="Abrir conversa de origem"
                    className="p-1.5 rounded-md text-text-faint hover:text-text-main hover:bg-surface-2 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={handleCopy}
                    title="Copiar"
                    className="p-1.5 rounded-md text-text-faint hover:text-text-main hover:bg-surface-2 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" strokeWidth={1.5} />}
                  </button>
                  <button
                    onClick={handleDownload}
                    title="Baixar"
                    className="p-1.5 rounded-md text-text-faint hover:text-text-main hover:bg-surface-2 transition-colors"
                  >
                    <Download className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {versions.length > 1 && (
                <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto flex-shrink-0">
                  <History className="w-3.5 h-3.5 text-text-faint flex-shrink-0" strokeWidth={1.5} />
                  {versions.map((v) => (
                    <button
                      key={v.version}
                      onClick={() => setViewingVersion(v.version === selected.version ? null : v)}
                      className={`px-2 py-0.5 rounded-md text-[11px] flex-shrink-0 transition-colors ${
                        (viewingVersion?.version ?? selected.version) === v.version
                          ? 'bg-accent-bg text-accent'
                          : 'text-text-faint hover:text-text-main hover:bg-surface-2'
                      }`}
                    >
                      v{v.version}
                    </button>
                  ))}
                </div>
              )}

              <pre className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
                {shownContent}
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
