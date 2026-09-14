/**
 * Pequeno helper para lembrar, no navegador, qual página e qual conversa estavam
 * abertas por último. O histórico em si mora no Supabase (ver lib/history.ts) —
 * isso aqui só resolve o problema de "recarreguei a página e voltei pra tela
 * inicial/chat em branco mesmo a conversa existindo no banco".
 *
 * Importante: é por navegador/dispositivo (não sincroniza entre eles), o que é
 * esperado — cada aba/dispositivo pode estar olhando uma conversa diferente.
 * Trocar de dispositivo continua funcionando porque a lista de conversas e as
 * mensagens vêm do banco; aqui só guardamos QUAL conversa deve ser reaberta
 * automaticamente naquele navegador.
 */

const PAGE_KEY = 'nexu:lastPage';
const CHAT_CONVERSATION_KEY = 'nexu:lastChatConversationId';
const COWORK_CONVERSATION_KEY = 'nexu:lastCoworkConversationId';
const DESIGN_CONVERSATION_KEY = 'nexu:lastDesignConversationId';
const CHAT_PENDING_PROJECT_KEY = 'nexu:pendingChatProjectId';
const COWORK_PENDING_PROJECT_KEY = 'nexu:pendingCoworkProjectId';
const DESIGN_PENDING_PROJECT_KEY = 'nexu:pendingDesignProjectId';

type RestorablePage = 'chat' | 'cowork' | 'design';
type ConversationMode = 'chat' | 'cowork' | 'design';

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // localStorage pode estar indisponível (modo privado, etc.) — falha silenciosa,
    // o app simplesmente não restaura o estado nesse caso.
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // idem
  }
}

export function getLastPage(): RestorablePage | null {
  const value = safeGet(PAGE_KEY);
  return value === 'chat' || value === 'cowork' || value === 'design' ? value : null;
}

export function setLastPage(page: RestorablePage | null) {
  safeSet(PAGE_KEY, page);
}

function keyFor(mode: ConversationMode) {
  if (mode === 'chat') return CHAT_CONVERSATION_KEY;
  if (mode === 'design') return DESIGN_CONVERSATION_KEY;
  return COWORK_CONVERSATION_KEY;
}

export function getLastConversationId(mode: ConversationMode): string | null {
  return safeGet(keyFor(mode));
}

export function setLastConversationId(mode: ConversationMode, conversationId: string | null) {
  safeSet(keyFor(mode), conversationId);
}

function pendingProjectKeyFor(mode: ConversationMode) {
  if (mode === 'chat') return CHAT_PENDING_PROJECT_KEY;
  if (mode === 'design') return DESIGN_PENDING_PROJECT_KEY;
  return COWORK_PENDING_PROJECT_KEY;
}

/** Usado pela página de Projetos: guarda "quero um chat novo dentro deste projeto" antes
 *  de navegar pro Chat/Cowork, já que a navegação hoje não passa parâmetros diretamente. */
export function setPendingProjectId(mode: ConversationMode, projectId: string) {
  safeSet(pendingProjectKeyFor(mode), projectId);
}

/** Lê e IMEDIATAMENTE limpa o projeto pendente — é consumido uma única vez, ao montar
 *  o Chat/Cowork, pra não recriar uma conversa nova toda vez que a página remontar. */
export function consumePendingProjectId(mode: ConversationMode): string | null {
  const value = safeGet(pendingProjectKeyFor(mode));
  if (value) safeSet(pendingProjectKeyFor(mode), null);
  return value;
}
