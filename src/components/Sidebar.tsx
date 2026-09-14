import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import {
  Plus,
  FolderKanban,
  FileCode,
  Layers,
  Palette,
  Settings,
  X,
  Trash2,
  LogOut,
  ChevronDown,
  FolderInput,
  Pencil,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { supabase } from '@/lib/supabase';
import { ConversationSummary, renameConversation } from '@/lib/history';
import { Project, listProjects, moveConversationToProject } from '@/lib/projects';

type AppPage = 'home' | 'chat' | 'cowork' | 'design' | 'projects' | 'artifacts' | 'account';

interface SidebarProps {
  session: Session;
  activePage: 'chat' | 'cowork' | 'design';
  conversations: ConversationSummary[];
  conversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  onNewConversation: () => void;
  onNavigate: (page: AppPage) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  /** Chamado depois de mover um chat pra outro projeto, pra quem tiver a lista de
   *  conversas em memória (ex.: pra atualizar o badge de projeto) recarregar se quiser. */
  onConversationMoved?: () => void;
  /** Chamado depois de renomear um chat, com o novo título, pra quem mantém a lista
   *  de conversas em memória atualizar o item sem precisar recarregar tudo. */
  onConversationRenamed?: (id: string, title: string) => void;
}

const NAV_ITEMS = [
  { key: 'projetos', label: 'Projetos', icon: FolderKanban, page: 'projects' as AppPage },
  { key: 'artefatos', label: 'Artefatos', icon: FileCode, page: 'artifacts' as AppPage },
  { key: 'cowork', label: 'Código', icon: Layers, page: 'cowork' as AppPage },
  { key: 'design', label: 'Nexu Design', icon: Palette, page: 'design' as AppPage },
  { key: 'personalizar', label: 'Personalizar', icon: Settings, page: 'account' as AppPage },
] as const;

export default function Sidebar({
  session,
  activePage,
  conversations,
  conversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  onConversationMoved,
  onConversationRenamed,
}: SidebarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [moveMenuFor, setMoveMenuFor] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const email = session.user.email ?? '';
  const initial = email.charAt(0).toUpperCase() || '?';

  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  const handleMove = async (conversationIdToMove: string, projectId: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    setMoveMenuFor(null);
    if (await moveConversationToProject(conversationIdToMove, projectId)) onConversationMoved?.();
  };

  const startRename = (c: ConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setMoveMenuFor(null);
    setRenamingId(c.id);
    setRenameValue(c.title);
  };

  const commitRename = async (id: string) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    if (await renameConversation(id, title)) onConversationRenamed?.(id, title);
  };

  const panel = (
    <div className="flex flex-col h-full w-64 bg-surface/60 border-r border-border flex-shrink-0">
      <div className="p-3 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-surface-2 transition-colors"
        >
          <span className="w-6 h-6 rounded-md bg-text-main flex items-center justify-center flex-shrink-0">
            <span className="text-bg font-serif font-semibold text-xs">N</span>
          </span>
          <span className="font-serif text-sm text-text-main">Nexus</span>
        </button>
        <button onClick={onCloseMobile} className="md:hidden p-1 text-text-faint hover:text-text-main">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 flex-shrink-0">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border text-sm text-text-main hover:bg-surface-2 transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          Novo
        </button>
      </div>

      <div className="px-3 mt-3 space-y-0.5 flex-shrink-0">
        {NAV_ITEMS.map((item) => {
          const isActive = item.page === activePage;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.page)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-accent-bg text-accent' : 'text-text-dim hover:text-text-main hover:bg-surface-2'
              }`}
            >
              <item.icon className="w-4 h-4" strokeWidth={1.5} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 px-3 flex-1 min-h-0 flex flex-col">
        <p className="text-[11px] uppercase tracking-wider text-text-faint px-1 mb-1.5 flex-shrink-0">
          Conversas e tarefas
        </p>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pb-2">
          {conversations.length === 0 ? (
            <p className="px-1.5 py-2 text-xs text-text-faint">Nenhuma conversa ainda.</p>
          ) : (
            conversations.map((c) => {
              const project = c.project_id ? projects.find((p) => p.id === c.project_id) : null;
              return (
                <div key={c.id} className="relative">
                  {renamingId === c.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(c.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={() => commitRename(c.id)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-surface-2 border border-border-strong text-text-main focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => onSelectConversation(c.id)}
                      onDoubleClick={(e) => startRename(c, e)}
                      className={`group w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                        conversationId === c.id ? 'bg-accent-bg text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text-main'
                      }`}
                    >
                      <span className="truncate flex-1">
                        {c.title}
                        {project && <span className="block text-[10px] text-text-faint truncate">{project.name}</span>}
                      </span>
                      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
                        <span
                          onClick={(e) => startRename(c, e)}
                          className="p-0.5 text-text-faint hover:text-text-main"
                          title="Renomear"
                        >
                          <Pencil className="w-3 h-3" />
                        </span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoveMenuFor(moveMenuFor === c.id ? null : c.id);
                          }}
                          className="p-0.5 text-text-faint hover:text-text-main"
                          title="Mover para projeto"
                        >
                          <FolderInput className="w-3 h-3" />
                        </span>
                        <span
                          onClick={(e) => onDeleteConversation(c.id, e)}
                          className="p-0.5 text-text-faint hover:text-red-400"
                          title="Excluir"
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      </span>
                    </button>
                  )}

                  {moveMenuFor === c.id && (
                    <div className="absolute z-40 left-2 right-2 mt-0.5 rounded-lg border border-border bg-bg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      <button
                        onClick={(e) => handleMove(c.id, null, e)}
                        className="w-full text-left px-3 py-1.5 text-xs text-text-dim hover:bg-surface-2"
                      >
                        Nenhum (remover do projeto)
                      </button>
                      {projects.map((p) => (
                        <button
                          key={p.id}
                          onClick={(e) => handleMove(c.id, p.id, e)}
                          className="w-full text-left px-3 py-1.5 text-xs text-text-dim hover:bg-surface-2 truncate"
                        >
                          {p.name}
                        </button>
                      ))}
                      {projects.length === 0 && (
                        <p className="px-3 py-1.5 text-[11px] text-text-faint">Nenhum projeto criado ainda.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="p-3 border-t border-border relative flex-shrink-0">
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-accent-soft text-accent flex items-center justify-center text-xs font-medium flex-shrink-0">
            {initial}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-xs text-text-main truncate">{email}</span>
            <span className="block text-[11px] text-text-faint">Plano Gratuito</span>
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-text-faint transition-transform flex-shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {userMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-border bg-bg shadow-lg overflow-hidden animate-fade-in">
            <button
              onClick={() => {
                setUserMenuOpen(false);
                onNavigate('account');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-text-dim hover:bg-surface-2 transition-colors border-b border-border"
            >
              <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />
              Editar conta
            </button>
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs text-text-dim">Tema</span>
              <ThemeToggle />
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-red-400 hover:bg-surface-2 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
              Sair
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: sidebar fixa, sempre visível */}
      <div className="hidden md:block h-screen sticky top-0">{panel}</div>

      {/* Mobile: vira um drawer sobre o conteúdo */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onCloseMobile} />
          <div className="absolute inset-y-0 left-0">{panel}</div>
        </div>
      )}
    </>
  );
}
