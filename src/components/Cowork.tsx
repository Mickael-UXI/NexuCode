import { useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import Editor from '@monaco-editor/react';
import {
  Send,
  ArrowLeft,
  Copy,
  Check,
  Trash2,
  User,
  Search,
  Globe,
  Github,
  FileDown,
  FileCode,
  Loader2,
  MessageSquare,
  Square,
  RotateCw,
  History,
  Plus,
  X,
  Crown,
  Play,
  Terminal,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  Wrench,
  Paperclip,
  Eye,
  Code2,
} from 'lucide-react';
import ModelSelector from '@/components/ModelSelector';
import ThemeToggle from '@/components/ThemeToggle';
import MarkdownMessage from '@/components/MarkdownMessage';
import {
  streamChatCompletion,
  deepSearch,
  browsePage,
  pushToGithub,
  downloadZip,
  extractProjectFiles,
  runCode,
  ApiMessage,
  ProjectFile,
  FinishReason,
  SandboxRunResult,
} from '@/lib/api';
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
  renameConversation,
  ConversationSummary,
} from '@/lib/history';
import { getLastConversationId, setLastConversationId, consumePendingProjectId } from '@/lib/localState';
import { getProject, createConversationInProject } from '@/lib/projects';
import { syncArtifactsFromContent } from '@/lib/artifacts';
import { extractFile, formatFilesForMessage } from '@/lib/files';
import CoworkPreview from '@/components/CoworkPreview';

interface Message {
  id: string;
  dbId?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  finishReason?: FinishReason;
  feedback?: 'up' | 'down';
}

interface CoworkProps {
  onNavigate: (page: 'home' | 'chat' | 'cowork' | 'design' | 'projects' | 'artifacts' | 'account') => void;
  session: Session;
  /** 'design' reaproveita toda a engine do Cowork (split screen, arquivos, sandbox)
   *  só trocando o system prompt e os textos pra um foco em mockups/UI (item 15 do backlog). */
  variant?: 'cowork' | 'design';
}

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const welcomeMessage = (variant: 'cowork' | 'design'): Message =>
  variant === 'design'
    ? {
        id: 'welcome',
        role: 'assistant',
        content:
          'Bem-vindo ao **Nexu Design** — o modo focado em mockups, telas e protótipos de UI.\n\nDescreva a tela ou o fluxo que você quer e eu vou montando o protótipo (HTML/CSS) ao vivo no painel ao lado.',
        timestamp: Date.now(),
      }
    : {
        id: 'welcome',
        role: 'assistant',
        content:
          'Bem-vindo ao **Nexus Cowork** — o modo completo, especializado em programação.\n\nDescreva o projeto ou a mudança que você quer e eu vou montando os arquivos ao vivo no painel ao lado. Quando terminar, você pode baixar tudo em .zip ou enviar direto para um repositório no GitHub.',
        timestamp: Date.now(),
      };

/** Extensão -> linguagem do Monaco Editor. */
const MONACO_LANGUAGE_BY_EXT: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  java: 'java', cs: 'csharp', php: 'php', kt: 'kotlin',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  json: 'json', html: 'html', css: 'css', scss: 'scss',
  md: 'markdown', sql: 'sql', sh: 'shell', bash: 'shell',
  yml: 'yaml', yaml: 'yaml', xml: 'xml', txt: 'plaintext',
};

/** Extensões que dá pra rodar de verdade no sandbox (Piston). */
const RUNNABLE_EXTENSIONS = new Set(['js', 'mjs', 'cjs', 'ts', 'py', 'rb', 'go', 'rs', 'java', 'cs', 'php', 'kt', 'c', 'cpp', 'sh', 'bash']);

/** Quantas vezes o autoheal tenta se corrigir sozinho antes de desistir e deixar
 *  pro usuário decidir — evita um loop infinito gastando mensagens/tokens à toa. */
const MAX_AUTOHEAL_ATTEMPTS = 3;

function getExtension(path: string) {
  return path.split('.').pop()?.toLowerCase() || '';
}

/** Um resultado do sandbox "tem erro" se a compilação ou a execução escreveram algo
 *  em stderr, ou se o processo terminou com código de saída diferente de zero. */
function hasSandboxError(result: SandboxRunResult): boolean {
  return !!result.compile?.stderr || !!result.run.stderr || (result.run.code !== null && result.run.code !== 0);
}

function getMonacoLanguage(path: string) {
  return MONACO_LANGUAGE_BY_EXT[getExtension(path)] || 'plaintext';
}

export default function Cowork({ onNavigate, session, variant = 'cowork' }: CoworkProps) {
  /** 'cowork' pro system prompt do servidor E pro modo salvo nos artefatos (a coluna
   *  `mode` do banco só aceita 'chat'/'cowork' — Nexu Design usa a mesma engine de
   *  arquivos, então artefatos gerados nele entram como 'cowork' também). */
  const apiMode: 'chat' | 'cowork' | 'design' = variant === 'design' ? 'design' : 'cowork';
  const storageMode: 'cowork' | 'design' = variant;
  const [messages, setMessages] = useState<Message[]>([welcomeMessage(variant)]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modelId, setModelId] = useState('');
  const [deepSearchOn, setDeepSearchOn] = useState(false);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  // Item 4 do backlog: anexo de arquivos (incluindo .zip) no Cowork — mesmo mecanismo do Chat.tsx.
  const [attachments, setAttachments] = useState<{ id: string; name: string; formatted: string }[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'chat' | 'files'>('chat');
  // Item 6 do backlog: alterna entre o editor de código e o preview ao vivo do projeto.
  const [panelView, setPanelView] = useState<'code' | 'preview'>('code');
  const [githubBusy, setGithubBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [projectInstructions, setProjectInstructions] = useState<string | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [limitBanner, setLimitBanner] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<SandboxRunResult | null>(null);
  const [runPanelOpen, setRunPanelOpen] = useState(false);
  const [autoHealing, setAutoHealing] = useState(false);
  const [autoHealAttempt, setAutoHealAttempt] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [editText, setEditText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingNewConversationProjectRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    refreshConversations();
    // Se veio da página de Projetos com "Novo Cowork neste projeto", prepara a criação
    // da conversa já vinculada. Senão, reabre a última conversa do Cowork nesse
    // navegador — evita perder o projeto (mensagens + árvore de arquivos) ao recarregar.
    const pendingProjectId = consumePendingProjectId(storageMode);
    if (pendingProjectId) {
      getProject(pendingProjectId).then((project) => setProjectInstructions(project?.instructions ?? undefined));
      pendingNewConversationProjectRef.current = pendingProjectId;
    } else {
      const lastId = getLastConversationId(storageMode);
      if (lastId) handleSelectConversation(lastId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshConversations = async () => {
    setConversations(await listConversations());
  };

  /** Item 4 do backlog: upload de qualquer arquivo (incluindo .zip, extraído no servidor)
   *  — o conteúdo lido vira parte do contexto da próxima mensagem enviada. */
  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsAttaching(true);
    for (const file of Array.from(fileList)) {
      const result = await extractFile(file);
      const formatted = formatFilesForMessage(file.name, result);
      setAttachments((prev) => [...prev, { id: generateId(), name: file.name, formatted }]);
    }
    setIsAttaching(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => setAttachments((prev) => prev.filter((a) => a.id !== id));

  const applyExtractedFiles = (content: string) => {
    const extracted = extractProjectFiles(content);
    if (extracted.length === 0) return;
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [f.path, f]));
      for (const f of extracted) map.set(f.path, f);
      return Array.from(map.values());
    });
    setActiveFile((prev) => prev ?? extracted[0].path);
    setMobileTab('files');
  };

  const rebuildFilesFromMessages = (msgs: Message[]) => {
    const map = new Map<string, ProjectFile>();
    for (const m of msgs) {
      if (m.role !== 'assistant') continue;
      for (const f of extractProjectFiles(m.content)) map.set(f.path, f);
    }
    const list = Array.from(map.values());
    setFiles(list);
    setActiveFile(list[0]?.path ?? null);
  };

  /** Roda uma resposta do assistente a partir de um histórico pronto pra API, extraindo
   *  arquivos do projeto conforme o texto chega. Reaproveitado por handleSend, handleRegenerate,
   *  handleEditSave e handleAutoHeal. Com `overwriteDbId`, sobrescreve a mensagem existente em vez
   *  de criar outra. Devolve o conteúdo final da resposta — o autoheal precisa dele pra extrair o
   *  arquivo corrigido sem depender de reler o estado (que só atualiza no próximo render). */
  const runAssistantTurn = async (
    apiHistory: ApiMessage[],
    convId: string | null,
    overwriteDbId?: string
  ): Promise<{ finalContent: string; error?: string; limitReached?: boolean }> => {
    const assistantId = generateId();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), dbId: overwriteDbId },
    ]);

    // Igual ao Chat: cria a linha no banco antes de começar a receber tokens e
    // sincroniza o conteúdo parcial periodicamente, pra sobreviver a quedas de
    // conexão ou fechamento da aba no meio da geração de um projeto grande.
    let liveDbId = overwriteDbId ?? null;
    if (!liveDbId && convId) {
      liveDbId = await saveMessage(convId, 'assistant', '');
      if (liveDbId) {
        setMessages((prev) => (liveDbId ? prev.map((m) => (m.id === assistantId ? { ...m, dbId: liveDbId! } : m)) : prev));
        refreshConversations();
      }
    }

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
      mode: apiMode,
      signal: abortRef.current.signal,
      accessToken: session.access_token,
      projectInstructions,
      onToken: (token) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const updated = { ...m, content: m.content + token };
            pendingContent = updated.content;
            applyExtractedFiles(updated.content);
            return updated;
          })
        );
      },
    });

    if (syncInterval) window.clearInterval(syncInterval);
    const finalContent = pendingContent;

    if (limitReached) {
      setLimitBanner(error || 'Você atingiu o limite diário de mensagens do plano gratuito.');
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      if (liveDbId && !overwriteDbId) deleteMessages([liveDbId]);
      setIsTyping(false);
      return { finalContent: '', error, limitReached: true };
    }
    if (error) {
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: `⚠️ ${error}` } : m)));
      if (liveDbId) updateMessageContent(liveDbId, finalContent || `⚠️ ${error}`);
      setIsTyping(false);
      return { finalContent: '', error };
    }

    setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, finishReason } : m)));
    if (liveDbId && finalContent) {
      await updateMessageContent(liveDbId, finalContent);
      if (convId) touchConversation(convId);
      refreshConversations();
    }
    // Item 3 do backlog: cada arquivo gerado (```lang:caminho```) já vira Artefato,
    // com histórico de versões — best-effort, nunca trava a conversa se falhar.
    syncArtifactsFromContent(convId, 'cowork', finalContent).catch(() => {});
    setIsTyping(false);
    return { finalContent };
  };

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

    let convId = conversationId;
    if (!convId) {
      const pendingProjectId = pendingNewConversationProjectRef.current;
      convId = pendingProjectId ? await createConversationInProject(displayText, pendingProjectId) : await createConversation(displayText);
      pendingNewConversationProjectRef.current = null;
      if (convId) {
        setConversationId(convId);
        setLastConversationId(storageMode, convId);
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
        context += `\n\n[Resultados de busca na web]\n${result.answer ?? ''}\n${summary}`;
      } catch (err: any) {
        context += `\n\n[Busca profunda falhou: ${err.message}]`;
      }
    }

    const apiHistory: ApiMessage[] = [...messages, { ...userMessage, content: userMessage.content + context }]
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }));

    await runAssistantTurn(apiHistory, convId);
  };

  /** Refaz a resposta na mesma posição, a partir do mesmo histórico anterior. */
  const handleRegenerate = async (id: string) => {
    if (isTyping || !modelId) return;
    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1 || messages[idx].role !== 'assistant') return;

    const previousDbId = messages[idx].dbId;
    const priorMessages = messages.slice(0, idx);
    setMessages(priorMessages);
    setLimitBanner(null);
    setIsTyping(true);

    // Os arquivos extraídos das mensagens removidas não fazem mais sentido — reconstrói
    // o painel de arquivos a partir do que sobrou antes de pedir a nova resposta.
    rebuildFilesFromMessages(priorMessages);

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

  /** Salva a edição de uma mensagem do usuário, descarta tudo que veio depois (tela, banco
   *  e arquivos extraídos) e gera uma nova resposta a partir do texto editado. */
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
    rebuildFilesFromMessages(truncated);

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

  const handleStop = () => abortRef.current?.abort();

  const handleContinue = async (id: string) => {
    if (isTyping || !modelId) return;
    const target = messages.find((m) => m.id === id);
    if (!target) return;

    setIsTyping(true);
    const history: ApiMessage[] = messages.filter((m) => m.id !== 'welcome').map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: 'Continue exatamente de onde parou, sem repetir o que já foi escrito.' });

    abortRef.current = new AbortController();
    const { error, finishReason } = await streamChatCompletion({
      messages: history,
      modelId,
      mode: apiMode,
      signal: abortRef.current.signal,
      accessToken: session.access_token,
      continuation: true,
      onToken: (token) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== id) return m;
            const updated = { ...m, content: m.content + token };
            applyExtractedFiles(updated.content);
            return updated;
          })
        );
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

  const handleNewConversation = () => {
    setMessages([welcomeMessage(variant)]);
    setConversationId(null);
    setLastConversationId(storageMode, null);
    setProjectInstructions(undefined);
    pendingNewConversationProjectRef.current = null;
    setFiles([]);
    setActiveFile(null);
    setLimitBanner(null);
    setRunResult(null);
  };

  const handleSelectConversation = async (id: string) => {
    const stored = await loadConversationMessages(id);
    const loaded: Message[] =
      stored.length === 0
        ? [welcomeMessage(variant)]
        : stored.map((m) => ({
            id: generateId(),
            dbId: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at).getTime(),
            feedback: m.feedback ?? undefined,
          }));
    setMessages(loaded);
    rebuildFilesFromMessages(loaded);
    setConversationId(id);
    setLastConversationId(storageMode, id);
    pendingNewConversationProjectRef.current = null;
    setHistoryOpen(false);
    setLimitBanner(null);
    setRunResult(null);

    const projectId = await getConversationProjectId(id);
    if (projectId) {
      const project = await getProject(projectId);
      setProjectInstructions(project?.instructions ?? undefined);
    } else {
      setProjectInstructions(undefined);
    }
  };

  const commitRenameConversation = async (id: string) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    if (await renameConversation(id, title)) {
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (await deleteConversation(id)) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) handleNewConversation();
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

  const handleDownloadZip = () => {
    if (files.length === 0) return alert('Ainda não há arquivos gerados nesta conversa.');
    downloadZip(files, 'nexus-cowork-project').catch((err) => alert(err.message));
  };

  const handleGithubPush = async () => {
    if (files.length === 0) return alert('Ainda não há arquivos gerados nesta conversa.');
    const owner = window.prompt('Owner/organização do repositório GitHub:');
    if (!owner) return;
    const repo = window.prompt('Nome do repositório:');
    if (!repo) return;
    setGithubBusy(true);
    try {
      const result = await pushToGithub({ owner, repo, files });
      const failed = result.results.filter((r) => !r.ok);
      if (failed.length > 0) {
        alert(`Alguns arquivos falharam:\n${failed.map((f) => `${f.path}: ${f.error}`).join('\n')}`);
      } else {
        alert(`Arquivos enviados com sucesso para ${result.repoUrl}`);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGithubBusy(false);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!activeFile) return;
    setFiles((prev) => prev.map((f) => (f.path === activeFile ? { ...f, content: value ?? '' } : f)));
  };

  const handleRunActiveFile = async () => {
    const active = files.find((f) => f.path === activeFile);
    if (!active || running) return;
    setRunning(true);
    setRunPanelOpen(true);
    setRunResult(null);
    try {
      const result = await runCode(getExtension(active.path), active.content);
      setRunResult(result);
    } catch (err: any) {
      setRunResult({ language: '', version: '', compile: null, run: { stdout: '', stderr: err.message, code: 1 } });
    } finally {
      setRunning(false);
    }
  };

  /** Autoheal: quando a última execução no sandbox falhou, manda o erro de volta pra
   *  IA pedindo o próprio arquivo corrigido, aplica a correção, roda de novo e repete
   *  até funcionar ou até MAX_AUTOHEAL_ATTEMPTS. Cada tentativa vira uma mensagem normal
   *  no chat (transparente, fica salva no histórico) e o arquivo/editor são atualizados
   *  ao vivo, igual a uma resposta normal do Cowork. */
  const handleAutoHeal = async () => {
    const active = files.find((f) => f.path === activeFile);
    if (!active || !modelId || isTyping || autoHealing || running || !runResult) return;
    if (!hasSandboxError(runResult)) return;

    setAutoHealing(true);
    setLimitBanner(null);

    let currentPath = active.path;
    let currentContent = active.content;
    let currentResult = runResult;
    let localHistory: ApiMessage[] = messages.filter((m) => m.id !== 'welcome').map((m) => ({ role: m.role, content: m.content }));
    let convId = conversationId;
    let healed = false;
    let gaveUpReason = '';

    for (let attempt = 1; attempt <= MAX_AUTOHEAL_ATTEMPTS; attempt++) {
      setAutoHealAttempt(attempt);

      const errorText =
        [currentResult.compile?.stderr, currentResult.run.stderr].filter(Boolean).join('\n').trim() ||
        `Processo terminou com código de saída ${currentResult.run.code}.`;

      const healPrompt = `🩹 **Autoheal** (tentativa ${attempt}/${MAX_AUTOHEAL_ATTEMPTS}): a execução de \`${currentPath}\` falhou no sandbox. Analise o erro abaixo, identifique a causa no código e devolva o arquivo **completo** já corrigido, no mesmo formato de bloco (\`\`\`lang:caminho\`). Não repita explicações longas, só corrija.\n\nErro do sandbox:\n\`\`\`\n${errorText}\n\`\`\`\n\nArquivo atual:\n\`\`\`${getExtension(currentPath)}:${currentPath}\n${currentContent}\n\`\`\``;

      const userMsg: Message = { id: generateId(), role: 'user', content: healPrompt, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      localHistory = [...localHistory, { role: 'user', content: healPrompt }];

      if (!convId) {
        convId = await createConversation(`Autoheal: ${currentPath}`);
        if (convId) {
          setConversationId(convId);
          setLastConversationId(storageMode, convId);
          refreshConversations();
        }
      }
      if (convId) {
        const savedId = await saveMessage(convId, 'user', healPrompt);
        if (savedId) userMsg.dbId = savedId;
      }

      setIsTyping(true);
      const { finalContent, error, limitReached } = await runAssistantTurn(localHistory, convId);

      if (limitReached || error || !finalContent) {
        gaveUpReason = limitReached
          ? 'Limite diário de mensagens atingido durante o autoheal.'
          : error || 'A IA não devolveu uma resposta válida.';
        break;
      }

      localHistory = [...localHistory, { role: 'assistant', content: finalContent }];

      const fixedFiles = extractProjectFiles(finalContent);
      const fixedFile = fixedFiles.find((f) => f.path === currentPath) ?? fixedFiles[0];
      if (!fixedFile) {
        gaveUpReason = 'A IA não devolveu o arquivo corrigido no formato esperado.';
        break;
      }

      currentPath = fixedFile.path;
      currentContent = fixedFile.content;
      setFiles((prev) => {
        const map = new Map(prev.map((f) => [f.path, f]));
        map.set(currentPath, { path: currentPath, content: currentContent });
        return Array.from(map.values());
      });
      setActiveFile(currentPath);

      setRunning(true);
      let newResult: SandboxRunResult;
      try {
        newResult = await runCode(getExtension(currentPath), currentContent);
      } catch (err: any) {
        newResult = { language: '', version: '', compile: null, run: { stdout: '', stderr: err.message, code: 1 } };
      }
      setRunning(false);
      setRunResult(newResult);
      currentResult = newResult;

      if (!hasSandboxError(newResult)) {
        healed = true;
        break;
      }
    }

    setAutoHealing(false);
    setAutoHealAttempt(0);

    const summary: Message = {
      id: generateId(),
      role: 'assistant',
      content: healed
        ? `✅ **Autoheal**: corrigi o erro e \`${currentPath}\` já roda sem erros no sandbox.`
        : `⚠️ **Autoheal**: não consegui corrigir automaticamente após ${MAX_AUTOHEAL_ATTEMPTS} tentativa(s). ${gaveUpReason} Dá uma olhada manual no arquivo \`${currentPath}\`.`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, summary]);
    if (convId) {
      const savedId = await saveMessage(convId, 'assistant', summary.content);
      if (savedId) summary.dbId = savedId;
      touchConversation(convId);
      refreshConversations();
    }
  };

  const renderContent = (content: string) => <MarkdownMessage content={content} />;

  const activeFileContent = files.find((f) => f.path === activeFile);
  const activeIsRunnable = activeFile ? RUNNABLE_EXTENSIONS.has(getExtension(activeFile)) : false;
  const lastMessage = messages[messages.length - 1];
  const canContinue =
    !isTyping &&
    lastMessage &&
    lastMessage.role === 'assistant' &&
    lastMessage.content &&
    (lastMessage.finishReason === 'length' || lastMessage.finishReason === 'aborted');

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => onNavigate('home')} className="p-1.5 text-text-dim hover:text-text-main transition-colors">
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-md bg-text-main flex items-center justify-center flex-shrink-0">
                <span className="text-bg font-serif font-semibold text-sm">N</span>
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-text-main text-sm">{variant === 'design' ? 'Nexu Design' : 'Nexus Cowork'}</span>
                  <span className="flex h-1.5 w-1.5">
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent animate-pulse-soft" />
                  </span>
                </div>
                <span className="text-xs text-text-faint truncate block">{session.user.email}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ThemeToggle />
            <div className="hidden md:flex items-center rounded-full border border-border p-0.5 text-xs mr-1">
              <button
                onClick={() => onNavigate('chat')}
                className="px-2.5 py-1 rounded-full text-text-faint hover:text-text-dim transition-colors"
              >
                Chat
              </button>
              <button
                onClick={() => onNavigate('cowork')}
                className={`px-2.5 py-1 rounded-full transition-colors ${
                  variant === 'cowork' ? 'bg-surface-2 text-text-main' : 'text-text-faint hover:text-text-dim'
                }`}
              >
                Cowork
              </button>
              <button
                onClick={() => onNavigate('design')}
                className={`px-2.5 py-1 rounded-full transition-colors ${
                  variant === 'design' ? 'bg-surface-2 text-text-main' : 'text-text-faint hover:text-text-dim'
                }`}
              >
                Nexu Design
              </button>
            </div>
            <button onClick={() => onNavigate('projects')} className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-xs text-text-dim hover:text-text-main transition-colors">
              Projetos
            </button>
            <button onClick={() => onNavigate('artifacts')} className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-xs text-text-dim hover:text-text-main transition-colors">
              Artefatos
            </button>
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className={`p-1.5 transition-colors rounded-md hover:bg-surface ${historyOpen ? 'text-accent' : 'text-text-dim hover:text-text-main'}`}
              title="Histórico de conversas"
            >
              <History className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button onClick={handleNewConversation} className="p-1.5 text-text-dim hover:text-text-main transition-colors rounded-md hover:bg-surface" title="Nova conversa">
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-2.5 flex items-center gap-2 flex-wrap">
          <ModelSelector value={modelId} onChange={setModelId} />
          <button
            onClick={() => setDeepSearchOn((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
              deepSearchOn ? 'border-accent/50 text-accent bg-accent-bg' : 'border-border text-text-dim hover:text-text-main'
            }`}
          >
            <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
            Busca profunda
          </button>
          <button onClick={handleBrowse} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs text-text-dim hover:text-text-main transition-colors">
            <Globe className="w-3.5 h-3.5" strokeWidth={1.5} />
            Ler página
          </button>
          <div className="flex-1" />
          <button
            onClick={handleDownloadZip}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs text-text-dim hover:text-text-main transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" strokeWidth={1.5} />
            Baixar .zip
          </button>
          <button
            onClick={handleGithubPush}
            disabled={githubBusy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs text-text-dim hover:text-text-main transition-colors disabled:opacity-50"
          >
            {githubBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Github className="w-3.5 h-3.5" strokeWidth={1.5} />}
            Enviar ao GitHub
          </button>
        </div>

        {historyOpen && (
          <div className="max-w-7xl mx-auto px-4 pb-3">
            <div className="border border-border rounded-lg bg-surface max-h-64 overflow-y-auto max-w-md">
              <button onClick={handleNewConversation} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-accent hover:bg-surface-2 border-b border-border">
                <Plus className="w-3.5 h-3.5" /> Nova conversa
              </button>
              {conversations.length === 0 ? (
                <p className="px-3 py-3 text-xs text-text-faint">Nenhuma conversa salva ainda.</p>
              ) : (
                conversations.map((c) =>
                  renamingId === c.id ? (
                    <input
                      key={c.id}
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRenameConversation(c.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={() => commitRenameConversation(c.id)}
                      className="w-full px-3 py-2 text-xs bg-surface-2 border-b border-border focus:outline-none text-text-main"
                    />
                  ) : (
                    <button
                      key={c.id}
                      onClick={() => handleSelectConversation(c.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(c.id);
                        setRenameValue(c.title);
                      }}
                      className={`group w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left hover:bg-surface-2 border-b border-border last:border-b-0 ${
                        conversationId === c.id ? 'text-accent bg-accent-bg' : 'text-text-dim'
                      }`}
                    >
                      <span className="truncate flex-1">{c.title}</span>
                      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(c.id);
                            setRenameValue(c.title);
                          }}
                          className="p-1 text-text-faint hover:text-text-main"
                          title="Renomear"
                        >
                          <Pencil className="w-3 h-3" />
                        </span>
                        <span onClick={(e) => handleDeleteConversation(c.id, e)} className="p-1 text-text-faint hover:text-red-400" title="Excluir">
                          <X className="w-3 h-3" />
                        </span>
                      </span>
                    </button>
                  )
                )
              )}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div className="md:hidden flex border-t border-border">
            <button
              onClick={() => setMobileTab('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs ${mobileTab === 'chat' ? 'text-accent border-b-2 border-accent' : 'text-text-faint'}`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> Conversa
            </button>
            <button
              onClick={() => setMobileTab('files')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs ${mobileTab === 'files' ? 'text-accent border-b-2 border-accent' : 'text-text-faint'}`}
            >
              <FileCode className="w-3.5 h-3.5" /> Arquivos ({files.length})
            </button>
          </div>
        )}
      </header>

      {/* Split screen: só divide a tela quando o Cowork começa a entregar arquivo/código.
          Antes disso, a conversa fica centralizada e ocupando a largura toda, igual ao modo Chat. */}
      <div
        className={`flex-1 w-full mx-auto grid min-h-0 transition-[max-width] duration-300 ${
          files.length > 0 ? 'max-w-7xl md:grid-cols-2' : 'max-w-3xl grid-cols-1'
        }`}
      >
        <div
          className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex flex-col min-h-0 ${
            files.length > 0 ? 'border-r border-border' : ''
          }`}
        >
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-6 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 animate-message-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className="flex-shrink-0 pt-0.5">
                    {msg.role === 'assistant' ? (
                      <span className="w-7 h-7 rounded-md bg-text-main flex items-center justify-center">
                        <span className="text-bg font-serif font-semibold text-xs">N</span>
                      </span>
                    ) : (
                      <div className="w-7 h-7 rounded-md border border-border bg-surface flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-text-dim" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                    {editingId === msg.id ? (
                      <div className="w-full max-w-sm">
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
                          className="w-full resize-none rounded-2xl border border-accent/50 bg-surface px-3.5 py-2 text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-accent"
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
                      <div className={`relative group inline-block max-w-full ${msg.role === 'user' ? 'bg-surface border border-border rounded-2xl rounded-tr-sm px-3.5 py-2' : ''}`}>
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
                            <Pencil className="w-3 h-3" /> Editar
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
                                <RotateCw className="w-3 h-3" /> Regenerar
                              </button>
                            )}
                            <button
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className="flex items-center gap-1 px-2 py-1 bg-bg border border-border rounded-md text-xs text-text-faint hover:text-accent"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3" /> Copiado
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" /> Copiar
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

              {limitBanner && (
                <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 animate-fade-in">
                  <Crown className="w-4.5 h-4.5 text-amber-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="text-sm text-text-main">{limitBanner}</p>
                    <button onClick={() => onNavigate('home')} className="mt-2 text-xs font-medium text-amber-400 hover:text-amber-300 underline underline-offset-2">
                      Ver planos e assinar o Pro
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-border p-3">
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
            <div className="relative flex items-end gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 w-11 h-11 rounded-2xl border border-border flex items-center justify-center text-text-dim hover:text-text-main hover:border-border-strong transition-colors"
                title="Anexar arquivo (inclui .zip)"
              >
                <Paperclip className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={modelId ? 'Descreva o que você quer construir...' : 'Configure uma chave de API no .env...'}
                className="flex-1 bg-surface border border-border rounded-2xl px-4 py-3 text-sm text-text-main placeholder:text-text-faint focus:border-text-faint focus:outline-none transition-colors resize-none max-h-32"
                style={{ minHeight: '44px' }}
              />
              {isTyping ? (
                <button
                  onClick={handleStop}
                  className="flex-shrink-0 w-11 h-11 bg-red-500/90 rounded-2xl flex items-center justify-center text-white hover:bg-red-500 transition-all"
                  title="Parar geração"
                >
                  <Square className="w-4 h-4" fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && attachments.length === 0) || !modelId}
                  className="flex-shrink-0 w-11 h-11 bg-text-main rounded-2xl flex items-center justify-center text-bg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent transition-all"
                >
                  <Send className="w-4.5 h-4.5" strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>
        </div>


        {/* Painel de arquivos — só existe na tela quando há algo pra mostrar (arquivo/código
            sendo entregue). Enquanto isso não acontece, nem entra no grid — é o que mantém
            o Cowork em coluna única, como o Chat, até a IA começar a produzir algo. */}
        {files.length > 0 && (
        <div className={`${mobileTab === 'files' ? 'flex' : 'hidden'} md:flex flex-col min-h-0 bg-surface/40 animate-fade-in`}>
            <>
              <div className="flex items-center justify-between border-b border-border bg-bg/60 flex-shrink-0">
                <div className="flex overflow-x-auto">
                  {files.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => setActiveFile(f.path)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-r border-border ${
                        activeFile === f.path ? 'bg-surface text-text-main' : 'text-text-faint hover:text-text-dim'
                      }`}
                    >
                      <FileCode className="w-3 h-3" />
                      {f.path.split('/').pop()}
                    </button>
                  ))}
                </div>
                {/* Item 6 do backlog: alterna Código/Preview sem depender de qual arquivo está aberto. */}
                <div className="flex items-center gap-0.5 px-1.5 flex-shrink-0">
                  <button
                    onClick={() => setPanelView('code')}
                    title="Código"
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
                      panelView === 'code' ? 'bg-surface text-text-main' : 'text-text-faint hover:text-text-dim'
                    }`}
                  >
                    <Code2 className="w-3 h-3" /> Código
                  </button>
                  <button
                    onClick={() => setPanelView('preview')}
                    title="Preview ao vivo"
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
                      panelView === 'preview' ? 'bg-surface text-text-main' : 'text-text-faint hover:text-text-dim'
                    }`}
                  >
                    <Eye className="w-3 h-3" /> Preview
                  </button>
                </div>
              </div>
              {panelView === 'preview' ? (
                <CoworkPreview files={files} />
              ) : (
                <>
              <div className="flex items-center justify-between px-3 py-1.5 text-xs text-text-faint font-mono border-b border-border">
                <span className="truncate">{activeFile}</span>
                {activeIsRunnable && (
                  <button
                    onClick={handleRunActiveFile}
                    disabled={running || autoHealing}
                    className="flex items-center gap-1 px-2 py-1 rounded-md border border-border text-text-dim hover:text-accent hover:border-accent/40 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Rodar
                  </button>
                )}
              </div>
              <div className="flex-1 min-h-0" style={{ height: runPanelOpen ? '65%' : '100%' }}>
                <Editor
                  key={activeFile}
                  height="100%"
                  language={activeFile ? getMonacoLanguage(activeFile) : 'plaintext'}
                  value={activeFileContent?.content ?? ''}
                  onChange={handleEditorChange}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                    padding: { top: 12 },
                  }}
                />
              </div>
              {runPanelOpen && (
                <div className="border-t border-border bg-bg/80 flex flex-col" style={{ height: '35%' }}>
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                    <span className="text-xs text-text-faint flex items-center gap-1.5">
                      <Terminal className="w-3 h-3" /> Resultado do sandbox {runResult?.version ? `(${runResult.language} ${runResult.version})` : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      {!running && runResult && hasSandboxError(runResult) && (
                        <button
                          onClick={handleAutoHeal}
                          disabled={autoHealing || isTyping}
                          title="Pedir pra IA corrigir o próprio erro e rodar de novo, automaticamente"
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-accent/40 text-accent text-[11px] hover:bg-accent-bg disabled:opacity-50 transition-colors"
                        >
                          {autoHealing ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Autoheal {autoHealAttempt}/{MAX_AUTOHEAL_ATTEMPTS}...
                            </>
                          ) : (
                            <>
                              <Wrench className="w-3 h-3" />
                              Autoheal
                            </>
                          )}
                        </button>
                      )}
                      <button onClick={() => setRunPanelOpen(false)} className="text-text-faint hover:text-text-main">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto px-3 py-2 font-mono text-xs whitespace-pre-wrap">
                    {running ? (
                      <span className="text-text-faint flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Executando...
                      </span>
                    ) : runResult ? (
                      <>
                        {runResult.compile && (runResult.compile.stdout || runResult.compile.stderr) && (
                          <div className="mb-2 text-text-faint">
                            {runResult.compile.stdout}
                            {runResult.compile.stderr && <span className="text-red-400">{runResult.compile.stderr}</span>}
                          </div>
                        )}
                        {runResult.run.stdout && <div className="text-text-main">{runResult.run.stdout}</div>}
                        {runResult.run.stderr && <div className="text-red-400">{runResult.run.stderr}</div>}
                        {!runResult.run.stdout && !runResult.run.stderr && <div className="text-text-faint">(sem saída)</div>}
                        {runResult.run.code !== null && runResult.run.code !== 0 && (
                          <div className="mt-1 text-text-faint">Código de saída: {runResult.run.code}</div>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              )}
                </>
              )}
            </>
        </div>
        )}
      </div>
    </div>
  );
}
