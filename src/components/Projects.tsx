import { useEffect, useState } from 'react';
import { ArrowLeft, FolderKanban, Plus, Trash2, X, MessageSquare, Pencil, Check } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import {
  Project,
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  moveConversationToProject,
} from '@/lib/projects';
import { listConversations, ConversationSummary } from '@/lib/history';
import { setPendingProjectId, setLastConversationId } from '@/lib/localState';

interface ProjectsProps {
  session: Session;
  onNavigate: (page: 'home' | 'chat' | 'cowork' | 'projects' | 'artifacts' | 'account') => void;
}

export default function Projects({ onNavigate }: ProjectsProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');

  const load = async () => {
    setLoading(true);
    const [p, c] = await Promise.all([listProjects(), listConversations()]);
    setProjects(p);
    setConversations(c);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setInstructions('');
  };

  const openCreate = () => {
    resetForm();
    setCreating(true);
    setEditing(false);
    setSelected(null);
  };

  const openEdit = (p: Project) => {
    setName(p.name);
    setDescription(p.description ?? '');
    setInstructions(p.instructions ?? '');
    setSelected(p);
    setEditing(true);
    setCreating(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (creating) {
      const created = await createProject({ name, description, instructions });
      if (created) {
        setCreating(false);
        resetForm();
        await load();
        setSelected(created);
      }
    } else if (editing && selected) {
      const ok = await updateProject(selected.id, {
        name,
        description: description || null,
        instructions: instructions || null,
      });
      if (ok) {
        setEditing(false);
        await load();
        setSelected((prev) => (prev ? { ...prev, name, description, instructions } : prev));
      }
    }
  };

  const handleDelete = async (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Apagar o projeto "${p.name}"? As conversas dentro dele não serão apagadas.`)) return;
    if (await deleteProject(p.id)) {
      if (selected?.id === p.id) setSelected(null);
      await load();
    }
  };

  const handleNewChatInProject = (mode: 'chat' | 'cowork', projectId: string) => {
    setPendingProjectId(mode, projectId);
    onNavigate(mode);
  };

  const handleOpenConversation = (mode: 'chat' | 'cowork', id: string) => {
    setLastConversationId(mode, id);
    onNavigate(mode);
  };

  const handleRemoveFromProject = async (conversationId: string) => {
    if (await moveConversationToProject(conversationId, null)) load();
  };

  const projectConversations = selected ? conversations.filter((c) => c.project_id === selected.id) : [];

  return (
    <div className="min-h-screen bg-bg text-text-main">
      <div className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => onNavigate('chat')}
            className="flex items-center gap-1.5 text-sm text-text-dim hover:text-text-main transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            Voltar
          </button>
          <span className="text-text-faint">/</span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <FolderKanban className="w-4 h-4" strokeWidth={1.5} />
            Projetos
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid md:grid-cols-[280px_1fr] gap-6">
        {/* Lista de projetos */}
        <div>
          <button
            onClick={openCreate}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-3 rounded-lg border border-border text-sm text-text-main hover:bg-surface-2 transition-colors"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            Novo projeto
          </button>

          {loading ? (
            <p className="text-sm text-text-faint px-1">Carregando…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-text-faint px-1">
              Nenhum projeto ainda. Projetos agrupam vários chats sob um mesmo contexto/instruções.
            </p>
          ) : (
            <div className="space-y-1">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelected(p);
                    setCreating(false);
                    setEditing(false);
                  }}
                  className={`group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                    selected?.id === p.id ? 'bg-accent-bg text-accent' : 'hover:bg-surface-2 text-text-dim hover:text-text-main'
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  <span
                    onClick={(e) => handleDelete(p, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-text-faint hover:text-red-400 flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Painel principal: formulário de criar/editar, ou detalhe do projeto selecionado */}
        <div className="min-h-[300px] rounded-xl border border-border bg-surface/40 p-5">
          {creating || editing ? (
            <div className="space-y-4 max-w-lg">
              <h2 className="text-base font-medium">{creating ? 'Novo projeto' : 'Editar projeto'}</h2>
              <div>
                <label className="block text-xs text-text-faint mb-1">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Redesign do site"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border-strong"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-text-faint mb-1">Descrição (opcional)</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Do que se trata esse projeto"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border-strong"
                />
              </div>
              <div>
                <label className="block text-xs text-text-faint mb-1">
                  Instruções persistentes (aplicadas em todos os chats deste projeto)
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Ex.: Sempre responda em português formal e cite as fontes usadas."
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm resize-none focus:outline-none focus:border-border-strong"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={!name.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-text-main text-bg text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  <Check className="w-4 h-4" strokeWidth={1.5} />
                  Salvar
                </button>
                <button
                  onClick={() => {
                    setCreating(false);
                    setEditing(false);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-sm text-text-dim hover:bg-surface-2 transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                  Cancelar
                </button>
              </div>
            </div>
          ) : selected ? (
            <div>
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="text-lg font-medium">{selected.name}</h2>
                <button
                  onClick={() => openEdit(selected)}
                  className="flex items-center gap-1 text-xs text-text-dim hover:text-text-main transition-colors flex-shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Editar
                </button>
              </div>
              {selected.description && <p className="text-sm text-text-dim mb-3">{selected.description}</p>}
              {selected.instructions && (
                <div className="mb-5 px-3 py-2.5 rounded-lg bg-surface-2 border border-border text-xs text-text-dim">
                  <span className="block text-text-faint uppercase tracking-wide text-[10px] mb-1">
                    Instruções do projeto
                  </span>
                  {selected.instructions}
                </div>
              )}

              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => handleNewChatInProject('chat', selected.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-text-main hover:bg-surface-2 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Novo chat
                </button>
                <button
                  onClick={() => handleNewChatInProject('cowork', selected.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-text-main hover:bg-surface-2 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Novo Cowork
                </button>
              </div>

              <p className="text-[11px] uppercase tracking-wider text-text-faint mb-1.5">Chats deste projeto</p>
              {projectConversations.length === 0 ? (
                <p className="text-sm text-text-faint">Nenhum chat associado ainda.</p>
              ) : (
                <div className="space-y-1">
                  {projectConversations.map((c) => (
                    <div
                      key={c.id}
                      className="group flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <button
                        onClick={() => handleOpenConversation('chat', c.id)}
                        className="flex items-center gap-2 text-sm text-text-dim hover:text-text-main truncate flex-1 text-left"
                      >
                        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                        <span className="truncate">{c.title}</span>
                      </button>
                      <button
                        onClick={() => handleRemoveFromProject(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-[11px] text-text-faint hover:text-red-400 flex-shrink-0"
                      >
                        Remover do projeto
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-text-faint py-16">
              <FolderKanban className="w-8 h-8 mb-3" strokeWidth={1.2} />
              <p className="text-sm">Selecione um projeto à esquerda ou crie um novo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
