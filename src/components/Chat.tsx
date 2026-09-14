import { useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import {
  Send,
  Copy,
  Check,
  User,
  Search,
  Globe,
  Loader2,
  Square,
  RotateCw,
  Plus,
  X,
  Crown,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  Menu,
  Sparkle,
  GraduationCap,
  FileCode,
  Terminal,
  Paperclip,
} from 'lucide-react';
import ModelSelector from '@/components/ModelSelector';
import MarkdownMessage from '@/components/MarkdownMessage';
import Sidebar from '@/components/Sidebar';
import { streamChatCompletion, deepSearch, browsePage, ApiMessage, FinishReason } from '@/lib/api';
import { extractFile, formatFilesForMessage } from '@/lib/files';
import {
  listConversations,
  loadConversationMessages,
  createConversation,
  touchConversation,
  deleteConversation,
  saveMessage,
  updateMessageContent,
  deleteMessages,
  saveMessageFeedback,
  getConversationProjectId,
  ConversationSummary,
} from '@/lib/history';
import { getLastConversationId, setLastConversationId, consumePendingProjectId } from '@/lib/localState';
import { getProject, createConversationInProject } from '@/lib/projects';
import { syncArtifactsFromContent } from '@/lib/artifacts';

interface Message {
  id: string;
  dbId?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  finishReason?: FinishReason;
  feedback?: 'up' | 'down';
}

interface ChatProps {
  onNavigate: (page: 'home' | 'chat' | 'cowork' | 'design' | 'projects' | 'artifacts' | 'account') => void;
  session: Session;
}

const suggestedPrompts = [
  'Escreva uma função de ordenação em TypeScript',
  'Explique como funciona recursão em Python',
  'Crie uma API REST com Node.js e Express',
  'Otimize este código para melhor performance',
];

/** Atalhos rápidos mostrados na tela inicial (equivalente aos chips "Escrever",
 *  "Aprender", "Código", "Assuntos pessoais" do Claude.ai, adaptados ao foco
 *  do Nexus em programação). */
const quickActions = [
  { label: 'Escrever função', icon: Pencil, prompt: suggestedPrompts[0] },
  { label: 'Aprender um conceito', icon: GraduationCap, prompt: suggestedPrompts[1] },
  { label: 'Criar API', icon: FileCode, prompt: suggestedPrompts[2] },
  { label: 'Otimizar código', icon: Terminal, prompt: suggestedPrompts[3] },
];

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const welcomeMessage: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Olá. Sou o **Nexus Agent**, seu assistente de desenvolvimento.\n\nEsse é o modo Chat — rápido e direto. Para projetos com vários arquivos e mais ferramentas, use o **Cowork**.',
  timestamp: Date.now(),
};

export default function Chat({ onNavigate, session }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modelId, setModelId] = useState('');
  const [deepSearchOn, setDeepSearchOn] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [projectInstructions, setProjectInstructions] = useState<string | undefined>(undefined);
  const [limitBanner, setLimitBanner] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<{ id: string; name: string; formatted: string }[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Projeto pendente pra vincular a próxima conversa criada (ver startConversationInProject). */
  const pendingNewConversationProjectRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    refreshConversations();
    // Se veio da página de Projetos com "Novo chat neste projeto", cria a conversa já
    // vinculada ao projeto. Senão, reabre a última conversa aberta nessa aba/navegador.
    const pendingProjectId = consumePendingProjectId('chat');
    if (pendingProjectId) {
      startConversationInProject(pendingProjectId);
    } else {
      const lastId = getLastConversationId('chat');
      if (lastId) handleSelectConversation(lastId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startConversationInProject = async (projectId: string) => {
    const project = await getProject(projectId);
    setProjectInstructions(project?.instructions ?? undefined);
    setMessages([welcomeMessage]);
    setConversationId(null);
    // A conversa só é efetivamente criada no banco quando a 1ª mensagem for enviada
    // (ver handleSend) — aqui só guardamos o projeto pra usar nesse momento.
    pendingNewConversationProjectRef.current = projectId;
  };

  const refreshConversations = async () => {
    const list = await listConversations();
    setConversations(list);
  };

  /** Roda uma resposta do assistente a partir de um histórico já pronto para a API.
   *  Reaproveitado por handleSend (mensagem nova), handleRegenerate (refazer resposta)
   *  e handleEditSave (reenviar depois de editar uma mensagem do usuário).
   *  Quando `overwriteDbId` é passado, a resposta antiga é sobrescrita na mesma linha
   *  do banco em vez de criar uma nova (usado no "regenerar"). */
  const runAssistantTurn = async (apiHistory: ApiMessage[], convId: string | null, overwriteDbId?: string) => {
    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), dbId: overwriteDbId },
    ]);

    // Cria a linha da resposta no banco ANTES de começar a receber tokens (em vez de só
    // no final do streaming). Assim, se a conexão cair ou a aba fechar no meio da resposta,
    // o que já foi gerado não se perde — fica salvo até o último trecho sincronizado.
    let liveDbId = overwriteDbId ?? null;
    if (!liveDbId && convId) {
      liveDbId = await saveMessage(convId, 'assistant', '');
      if (liveDbId) {
        setMessages((prev) => (liveDbId ? prev.map((m) => (m.id === assistantId ? { ...m, dbId: liveDbId! } : m)) : prev));
        refreshConversations();
      }
    }

    // Sincroniza o conteúdo parcial periodicamente durante o streaming (sem gravar a
    // cada token, pra não sobrecarregar o banco). O acabamento final ainda faz um
    // último update garantido, mesmo que o intervalo não tenha rodado por último.
    let lastSyncedContent = '';
    let pendingContent = '';
    const syncPartial = () => {
      if (!liveDbId || pendingContent === lastSyncedContent) return;
      lastSyncedContent = pendingContent;
      updateMessageContent(liveDbId, pendingContent);
    };
    const syncInterval = liveDbId ? window.setInterval(syncPartial, 1200) : null;

    abortRef.current = new AbortController();
    const { error, limitReached, finishReason } = await streamChatCompletion({
      messages: apiHistory,
      modelId,
      mode: 'chat',
      signal: abortRef.current.signal,
      accessToken: session.access_token,
      projectInstructions,
      onToken: (token) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const updated = { ...m, content: m.content + token };
            pendingContent = updated.content;
            return updated;
          })
        );
      },
    });

    if (syncInterval) window.clearInterval(syncInterval);

    if (limitReached) {
      setLimitBanner(error || 'Você atingiu o limite diário de mensagens do plano gratuito.');
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      if (liveDbId && !overwriteDbId) deleteMessages([liveDbId]);
    } else if (error) {
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: `⚠️ ${error}` } : m)));
      if (liveDbId) updateMessageContent(liveDbId, pendingContent || `⚠️ ${error}`);
    } else {
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, finishReason } : m)));
      const finalContent = pendingContent;
      if (liveDbId && finalContent) {
        await updateMessageContent(liveDbId, finalContent);
        if (convId) touchConversation(convId);
        refreshConversations();
      }
      // Item 3 do backlog: qualquer bloco de código "grande" na resposta vira Artefato
      // automaticamente (best-effort — nunca trava a conversa se falhar).
      syncArtifactsFromContent(convId, 'chat', finalContent).catch(() => {});
    }
    setIsTyping(false);
  };

  /** Item 12 do backlog: upload de qualquer arquivo (incluindo .zip, extraído no servidor)
   *  — o conteúdo lido vira parte do contexto da próxima mensagem enviada. */
  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsAttaching(true);
    setToolsMenuOpen(false);
    for (const file of Array.from(fileList)) {
      const result = await extractFile(file);
      const formatted = formatFilesForMessage(file.name, result);
      setAttachments((prev) => [...prev, { id: generateId(), name: file.name, formatted }]);
    }
    setIsAttaching(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => setAttachments((prev) => prev.filter((a) => a.id !== id));

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if ((!text && attachments.length === 0) || isTyping || !modelId) return;

    setLimitBanner(null);
    const pendingAttachments = attachments;
    setAttachments([]);
    const displayText = text || (pendingAttachments.length === 1 ? `Arquivo enviado: ${pendingAttachments[0].name}` : `${pendingAttachments.length} arquivos enviados`);
    const userMessage: Message = { id: generateId(), role: 'user', content: displayText, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Garante que existe uma conversa pra salvar o histórico antes de mandar pra IA.
    let convId = conversationId;
    if (!convId) {
      const pendingProjectId = pendingNewConversationProjectRef.current;
      convId = pendingProjectId ? await createConversationInProject(displayText, pendingProjectId) : await createConversation(displayText);
      pendingNewConversationProjectRef.current = null;
      if (convId) {
        setConversationId(convId);
        setLastConversationId('chat', convId);
        refreshConversations();
      }
    }
    if (convId) {
      const savedId = await saveMessage(convId, 'user', displayText);
      if (savedId) userMessage.dbId = savedId;
    }

    let context = pendingAttachments.length > 0 ? `\n\n${pendingAttachments.map((a) => a.formatted).join('\n\n')}` : '';
    if (deepSearchOn) {
      try {
        const result = await deepSearch(text);
        const summary = result.results.map((r) => `- ${r.title}: ${r.content.slice(0, 200)} (${r.url})`).join('\n');
        context = `\n\n[Resultados de busca na web]\n${result.answer ?? ''}\n${summary}`;
      } catch (err: any) {
        context = `\n\n[Busca profunda falhou: ${err.message}]`;
      }
    }

    const apiHistory: ApiMessage[] = [...messages, { ...userMessage, content: userMessage.content + context }]
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }));

    await runAssistantTurn(apiHistory, convId);
  };

  /** Refaz a resposta do assistente na mesma posição, a partir do mesmo histórico anterior.
   *  A resposta antiga é descartada (localmente e no banco, se já tinha sido salva). */
  const handleRegenerate = async (id: string) => {
    if (isTyping || !modelId) return;
    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1 || messages[idx].role !== 'assistant') return;

    const previousDbId = messages[idx].dbId;
    const priorMessages = messages.slice(0, idx);
    setMessages(priorMessages);
    setLimitBanner(null);
    setIsTyping(true);

    const apiHistory: ApiMessage[] = priorMessages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }));

    await runAssistantTurn(apiHistory, conversationId, previousDbId);
  };

  const handleEditStart = (msg: Message) => {
    if (isTyping) return;
    setEditingId(msg.id);
    setEditText(msg.content);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditText('');
  };

  /** Salva a edição de uma mensagem do usuário, descarta tudo que veio depois dela
   *  (na tela e no banco) e gera uma nova resposta a partir do texto editado. */
  const handleEditSave = async (id: string) => {
    const idx = messages.findIndex((m) => m.id === id);
    const newText = editText.trim();
    if (idx === -1 || !newText) return;

    const removedIds = messages.slice(idx + 1).map((m) => m.dbId).filter((v): v is string => !!v);
    const edited: Message = { ...messages[idx], content: newText };
    const truncated = [...messages.slice(0, idx), edited];

    setMessages(truncated);
    setEditingId(null);
    setEditText('');
    setLimitBanner(null);

    if (edited.dbId) updateMessageContent(edited.dbId, newText);
    if (removedIds.length) deleteMessages(removedIds);

    if (!modelId) return;
    setIsTyping(true);
    const apiHistory: ApiMessage[] = truncated.filter((m) => m.id !== 'welcome').map((m) => ({ role: m.role, content: m.content }));
    await runAssistantTurn(apiHistory, conversationId);
  };

  /** Alterna o feedback 👍/👎 de uma resposta (clicar de novo no mesmo remove). */
  const handleFeedback = (id: string, value: 'up' | 'down') => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = m.feedback === value ? undefined : value;
        if (m.dbId) saveMessageFeedback(m.dbId, next ?? null);
        return { ...m, feedback: next };
      })
    );
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleContinue = async (id: string) => {
    if (isTyping || !modelId) return;
    const target = messages.find((m) => m.id === id);
    if (!target) return;

    setIsTyping(true);
    const history: ApiMessage[] = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }));
    history.push({
      role: 'user',
      content: 'Continue exatamente de onde parou, sem repetir o que já foi escrito.',
    });

    abortRef.current = new AbortController();
    const { error, finishReason } = await streamChatCompletion({
      messages: history,
      modelId,
      mode: 'chat',
      signal: abortRef.current.signal,
      accessToken: session.access_token,
      continuation: true,
      projectInstructions,
      onToken: (token) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + token } : m)));
      },
    });

    if (error) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + `\n\n⚠️ ${error}` } : m)));
    } else {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, finishReason } : m)));
      const updated = messages.find((m) => m.id === id);
      if (updated?.dbId) {
        let finalContent = '';
        setMessages((prev) => {
          finalContent = prev.find((m) => m.id === id)?.content ?? '';
          return prev;
        });
        if (finalContent) updateMessageContent(updated.dbId, finalContent);
      }
    }
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([welcomeMessage]);
    setConversationId(null);
    setLastConversationId('chat', null);
    setProjectInstructions(undefined);
    pendingNewConversationProjectRef.current = null;
    setLimitBanner(null);
    setSidebarMobileOpen(false);
  };

  const handleSelectConversation = async (id: string) => {
    const stored = await loadConversationMessages(id);
    if (stored.length === 0) {
      setMessages([welcomeMessage]);
    } else {
      setMessages(
        stored.map((m) => ({
          id: generateId(),
          dbId: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at).getTime(),
          feedback: m.feedback ?? undefined,
        }))
      );
    }
    setConversationId(id);
    setLastConversationId('chat', id);
    pendingNewConversationProjectRef.current = null;
    setLimitBanner(null);
    setSidebarMobileOpen(false);

    // Se essa conversa pertence a um projeto, carrega as instruções dele pra somar ao
    // system prompt das próximas mensagens.
    const projectId = await getConversationProjectId(id);
    if (projectId) {
      const project = await getProject(projectId);
      setProjectInstructions(project?.instructions ?? undefined);
    } else {
      setProjectInstructions(undefined);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await deleteConversation(id);
    if (ok) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) handleClear();
    }
  };

  const handleBrowse = async () => {
    const url = window.prompt('Qual URL você quer que o Nexus leia?');
    if (!url) return;
    try {
      setIsTyping(true);
      const page = await browsePage(url);
      setInput((prev) => `${prev}\n\nConteúdo de ${page.url} ("${page.title}"):\n${page.text.slice(0, 1500)}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsTyping(false);
    }
  };

  const renderContent = (content: string) => <MarkdownMessage content={content} />;

  const lastMessage = messages[messages.length - 1];
  const canContinue =
    !isTyping &&
    lastMessage &&
    lastMessage.role === 'assistant' &&
    lastMessage.content &&
    (lastMessage.finishReason === 'length' || lastMessage.finishReason === 'aborted');

  const isEmptyState = messages.length <= 1 && !isTyping;

  /** Caixa de mensagem reutilizada tanto na tela inicial (maior, centralizada)
   *  quanto na barra fixa embaixo durante a conversa (mais compacta). O "+"
   *  concentra as ferramentas (busca profunda, ler página), no mesmo espírito
   *  do menu de ferramentas do Claude.ai. */
  const renderComposer = (variant: 'hero' | 'bar') => (
    <div
      className={`relative rounded-3xl border border-border bg-surface transition-colors focus-within:border-border-strong ${
        variant === 'hero' ? 'p-4 shadow-sm' : 'p-2.5'
      }`}
    >
      {deepSearchOn && (
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-bg text-accent text-[11px]">
            <Search className="w-3 h-3" strokeWidth={1.5} />
            Busca profunda ativa
            <button onClick={() => setDeepSearchOn(false)} className="hover:text-accent/70">
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
      {(attachments.length > 0 || isAttaching) && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2 px-1">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 text-text-dim text-[11px]"
            >
              <Paperclip className="w-3 h-3" strokeWidth={1.5} />
              <span className="max-w-[140px] truncate">{a.name}</span>
              <button onClick={() => removeAttachment(a.id)} className="hover:text-text-main">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {isAttaching && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 text-text-faint text-[11px]">
              <Loader2 className="w-3 h-3 animate-spin" />
              Lendo arquivo…
            </span>
          )}
        </div>
      )}
      <textarea
        ref={variant === 'bar' ? inputRef : undefined}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={variant === 'hero' ? 2 : 1}
        placeholder={modelId ? 'Como posso ajudar você hoje?' : 'Configure uma chave de API no .env para conversar...'}
        className={`w-full bg-transparent resize-none focus:outline-none text-text-main placeholder:text-text-faint px-1.5 ${
          variant === 'hero' ? 'text-base pt-1' : 'text-sm'
        }`}
        style={{ minHeight: variant === 'hero' ? '52px' : '24px', maxHeight: '160px' }}
      />
      <div className="flex items-center justify-between mt-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              onClick={() => setToolsMenuOpen((v) => !v)}
              className="relative w-8 h-8 rounded-full border border-border flex items-center justify-center text-text-dim hover:text-text-main hover:border-border-strong transition-colors"
              title="Ferramentas"
            >
              <Plus className="w-4 h-4" strokeWidth={1.5} />
              {deepSearchOn && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent" />}
            </button>
            {toolsMenuOpen && (
              <div className="absolute bottom-10 left-0 w-56 rounded-xl border border-border bg-bg shadow-lg overflow-hidden z-20 py-1 animate-fade-in">
                <button
                  onClick={() => {
                    setDeepSearchOn((v) => !v);
                    setToolsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-surface text-text-dim"
                >
                  <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Busca profunda
                  {deepSearchOn && <Check className="w-3 h-3 ml-auto text-accent" />}
                </button>
                <button
                  onClick={() => {
                    setToolsMenuOpen(false);
                    handleBrowse();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-surface text-text-dim"
                >
                  <Globe className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Ler página
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-surface text-text-dim"
                >
                  <Paperclip className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Anexar arquivo (inclui .zip)
                </button>
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center rounded-full border border-border p-0.5 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-surface-2 text-text-main">Chat</span>
            <button
              onClick={() => onNavigate('cowork')}
              className="px-2.5 py-1 rounded-full text-text-faint hover:text-text-dim transition-colors"
            >
              Cowork
            </button>
            <button
              onClick={() => onNavigate('design')}
              className="px-2.5 py-1 rounded-full text-text-faint hover:text-text-dim transition-colors"
            >
              Nexu Design
            </button>
          </div>

          <ModelSelector value={modelId} onChange={setModelId} />
        </div>

        {isTyping ? (
          <button
            onClick={handleStop}
            className="flex-shrink-0 w-9 h-9 bg-red-500/90 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-all"
            title="Parar geração"
          >
            <Square className="w-3.5 h-3.5" fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={() => handleSend()}
            disabled={(!input.trim() && attachments.length === 0) || !modelId}
            className="flex-shrink-0 w-9 h-9 bg-text-main rounded-full flex items-center justify-center text-bg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent transition-all"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar
        session={session}
        activePage="chat"
        conversations={conversations}
        conversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onNewConversation={handleClear}
        onNavigate={onNavigate}
        mobileOpen={sidebarMobileOpen}
        onCloseMobile={() => setSidebarMobileOpen(false)}
        onConversationMoved={refreshConversations}
        onConversationRenamed={(id, title) =>
          setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
        }
      />

      <div className="flex-1 min-w-0 flex flex-col h-screen">
        <div className="flex items-center justify-between px-4 h-12 flex-shrink-0">
          <button
            onClick={() => setSidebarMobileOpen(true)}
            className="md:hidden p-1.5 -ml-1.5 text-text-dim hover:text-text-main transition-colors"
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-xs text-text-faint">
            <span>Plano Gratuito</span>
            <span>·</span>
            <button onClick={() => onNavigate('home')} className="text-accent hover:underline underline-offset-2">
              Fazer Upgrade
            </button>
          </div>
        </div>

        {isEmptyState ? (
          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-10">
            <div className="w-full max-w-2xl animate-fade-in">
              <div className="flex items-center justify-center gap-3 mb-8">
                <Sparkle className="w-7 h-7 text-accent flex-shrink-0" strokeWidth={1.5} />
                <h1 className="text-2xl sm:text-3xl font-serif text-text-main text-center">
                  O que vamos construir juntos?
                </h1>
              </div>

              {renderComposer('hero')}

              <div className="flex flex-wrap justify-center gap-2 mt-5">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleSend(action.prompt)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border text-xs text-text-dim hover:text-text-main hover:border-border-strong hover:bg-surface transition-colors"
                  >
                    <action.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-4 py-8">
                <div className="space-y-8">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-4 animate-message-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className="flex-shrink-0 pt-0.5">
                        {msg.role === 'assistant' ? (
                          <span className="w-8 h-8 rounded-md bg-text-main flex items-center justify-center">
                            <span className="text-bg font-serif font-semibold text-sm">N</span>
                          </span>
                        ) : (
                          <div className="w-8 h-8 rounded-md border border-border bg-surface flex items-center justify-center">
                            <User className="w-4 h-4 text-text-dim" strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                      <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                        {editingId === msg.id ? (
                          <div className="w-full max-w-md">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleEditSave(msg.id);
                                } else if (e.key === 'Escape') {
                                  handleEditCancel();
                                }
                              }}
                              autoFocus
                              rows={Math.min(8, Math.max(2, editText.split('\n').length))}
                              className="w-full resize-none rounded-2xl border border-accent/50 bg-surface px-4 py-2.5 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-accent"
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button
                                onClick={handleEditCancel}
                                className="px-3 py-1.5 rounded-md border border-border text-xs text-text-dim hover:text-text-main transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleEditSave(msg.id)}
                                disabled={!editText.trim()}
                                className="px-3 py-1.5 rounded-md bg-accent text-white text-xs hover:bg-accent/90 disabled:opacity-40 transition-colors"
                              >
                                Salvar e reenviar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`relative group inline-block max-w-full ${
                              msg.role === 'user' ? 'bg-surface border border-border rounded-2xl rounded-tr-sm px-4 py-2.5' : ''
                            }`}
                          >
                            <div className="prose prose-invert max-w-none">
                              {msg.content ? renderContent(msg.content) : isTyping && msg.role === 'assistant' ? (
                                <Loader2 className="w-4 h-4 animate-spin text-text-faint" />
                              ) : null}
                            </div>

                            {msg.role === 'user' && msg.id !== 'welcome' && (
                              <button
                                onClick={() => handleEditStart(msg)}
                                title="Editar e reenviar"
                                className="absolute -bottom-2.5 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 bg-bg border border-border rounded-md text-xs text-text-faint hover:text-accent"
                              >
                                <Pencil className="w-3 h-3" />
                                Editar
                              </button>
                            )}

                            {msg.role === 'assistant' && msg.id !== 'welcome' && msg.content && (
                              <div className="absolute -bottom-2.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                <button
                                  onClick={() => handleFeedback(msg.id, 'up')}
                                  title="Boa resposta"
                                  className={`flex items-center px-1.5 py-1 bg-bg border border-border rounded-md text-xs hover:text-accent ${
                                    msg.feedback === 'up' ? 'text-accent border-accent/40' : 'text-text-faint'
                                  }`}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleFeedback(msg.id, 'down')}
                                  title="Resposta ruim"
                                  className={`flex items-center px-1.5 py-1 bg-bg border border-border rounded-md text-xs hover:text-accent ${
                                    msg.feedback === 'down' ? 'text-accent border-accent/40' : 'text-text-faint'
                                  }`}
                                >
                                  <ThumbsDown className="w-3 h-3" />
                                </button>
                                {!isTyping && (
                                  <button
                                    onClick={() => handleRegenerate(msg.id)}
                                    title="Regenerar resposta"
                                    className="flex items-center gap-1 px-2 py-1 bg-bg border border-border rounded-md text-xs text-text-faint hover:text-accent"
                                  >
                                    <RotateCw className="w-3 h-3" />
                                    Regenerar
                                  </button>
                                )}
                                <button
                                  onClick={() => handleCopy(msg.id, msg.content)}
                                  className="flex items-center gap-1 px-2 py-1 bg-bg border border-border rounded-md text-xs text-text-faint hover:text-accent"
                                >
                                  {copiedId === msg.id ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      Copiado
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      Copiar
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {msg.id === lastMessage?.id && canContinue && (
                          <button
                            onClick={() => handleContinue(msg.id)}
                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-accent/40 text-accent text-xs hover:bg-accent-bg transition-colors"
                          >
                            <RotateCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                            Continuar gerando
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {limitBanner && (
                  <div className="mt-6 flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 animate-fade-in">
                    <Crown className="w-4.5 h-4.5 text-amber-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                    <div className="min-w-0">
                      <p className="text-sm text-text-main">{limitBanner}</p>
                      <button
                        onClick={() => onNavigate('home')}
                        className="mt-2 text-xs font-medium text-amber-400 hover:text-amber-300 underline underline-offset-2"
                      >
                        Ver planos e assinar o Pro
                      </button>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} className="h-4" />
              </div>
            </div>

            <div className="border-t border-border bg-bg/90 backdrop-blur-md flex-shrink-0">
              <div className="max-w-3xl mx-auto px-4 py-3">
                {renderComposer('bar')}
                <p className="text-xs text-text-faint text-center mt-2">Nexus IA pode cometer erros. Verifique informações importantes.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
