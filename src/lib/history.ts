import { supabase } from '@/lib/supabase';

export interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
  project_id: string | null;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  feedback?: 'up' | 'down' | null;
}

/** Lista as conversas do usuário logado, mais recentes primeiro. RLS garante que só vêm as dele. */
export async function listConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, title, updated_at, project_id')
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error('Falha ao listar conversas:', error.message);
    return [];
  }
  return data ?? [];
}

/** Carrega todas as mensagens de uma conversa, em ordem cronológica. */
export async function loadConversationMessages(conversationId: string): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at, feedback')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Falha ao carregar mensagens:', error.message);
    return [];
  }
  return (data ?? []) as StoredMessage[];
}

/** Descobre a qual projeto (se algum) uma conversa pertence — usado ao restaurar/abrir
 *  uma conversa, pra saber se precisa carregar as instruções do projeto dela. */
export async function getConversationProjectId(conversationId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('project_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (error || !data) return null;
  return data.project_id ?? null;
}

/** Cria uma nova conversa com título derivado da primeira mensagem do usuário. */
export async function createConversation(firstMessage: string): Promise<string | null> {
  const title = firstMessage.trim().slice(0, 60) || 'Nova conversa';
  const { data, error } = await supabase.from('chat_conversations').insert({ title }).select('id').single();
  if (error) {
    console.error('Falha ao criar conversa:', error.message);
    return null;
  }
  return data?.id ?? null;
}

/** Renomeia manualmente uma conversa (item 16 do backlog). */
export async function renameConversation(conversationId: string, title: string): Promise<boolean> {
  const trimmed = title.trim().slice(0, 80);
  if (!trimmed) return false;
  const { error } = await supabase.from('chat_conversations').update({ title: trimmed }).eq('id', conversationId);
  if (error) {
    console.error('Falha ao renomear conversa:', error.message);
    return false;
  }
  return true;
}

/** Marca a conversa como recém-atualizada (pra subir no topo da lista). */
export async function touchConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);
  if (error) console.error('Falha ao atualizar conversa:', error.message);
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  const { error } = await supabase.from('chat_conversations').delete().eq('id', conversationId);
  if (error) {
    console.error('Falha ao apagar conversa:', error.message);
    return false;
  }
  return true;
}

/** Insere uma mensagem e devolve o id gerado (usado depois pra fazer update, no caso de "continuar gerando"). */
export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ conversation_id: conversationId, role, content })
    .select('id')
    .single();
  if (error) {
    console.error('Falha ao salvar mensagem:', error.message);
    return null;
  }
  return data?.id ?? null;
}

/** Atualiza o conteúdo de uma mensagem já salva (usado ao "continuar gerando" um texto cortado,
 *  ao editar uma mensagem do usuário, e ao sobrescrever uma resposta regenerada). */
export async function updateMessageContent(messageId: string, content: string): Promise<void> {
  const { error } = await supabase.from('chat_messages').update({ content }).eq('id', messageId);
  if (error) console.error('Falha ao atualizar mensagem:', error.message);
}

/** Remove um conjunto de mensagens (usado ao editar uma mensagem do usuário: tudo que veio
 *  depois dela na conversa deixa de fazer sentido e é apagado). */
export async function deleteMessages(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  const { error } = await supabase.from('chat_messages').delete().in('id', messageIds);
  if (error) console.error('Falha ao apagar mensagens:', error.message);
}

/** Salva (ou remove, passando null) o feedback 👍/👎 de uma mensagem do assistente. */
export async function saveMessageFeedback(messageId: string, feedback: 'up' | 'down' | null): Promise<void> {
  const { error } = await supabase.from('chat_messages').update({ feedback }).eq('id', messageId);
  if (error) console.error('Falha ao salvar feedback:', error.message);
}
