import { supabase } from '@/lib/supabase';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  created_at: string;
  updated_at: string;
}

/** Lista os projetos do usuário logado, mais recentemente atualizados primeiro. */
export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, description, instructions, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('Falha ao listar projetos:', error.message);
    return [];
  }
  return data ?? [];
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, description, instructions, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('Falha ao carregar projeto:', error.message);
    return null;
  }
  return data;
}

export async function createProject(input: {
  name: string;
  description?: string;
  instructions?: string;
}): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: input.name.trim() || 'Novo projeto',
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
    })
    .select('id, name, description, instructions, created_at, updated_at')
    .single();
  if (error) {
    console.error('Falha ao criar projeto:', error.message);
    return null;
  }
  return data;
}

export async function updateProject(
  id: string,
  input: { name?: string; description?: string | null; instructions?: string | null }
): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('Falha ao atualizar projeto:', error.message);
    return false;
  }
  return true;
}

/** Apaga o projeto. As conversas associadas NÃO são apagadas — só deixam de
 *  pertencer a um projeto (ver ON DELETE SET NULL na migration). */
export async function deleteProject(id: string): Promise<boolean> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) {
    console.error('Falha ao apagar projeto:', error.message);
    return false;
  }
  return true;
}

/** Move (ou remove de qualquer projeto, passando null) uma conversa existente. */
export async function moveConversationToProject(conversationId: string, projectId: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('chat_conversations')
    .update({ project_id: projectId })
    .eq('id', conversationId);
  if (error) {
    console.error('Falha ao mover conversa de projeto:', error.message);
    return false;
  }
  return true;
}

/** Cria uma conversa nova já dentro de um projeto. */
export async function createConversationInProject(firstMessage: string, projectId: string): Promise<string | null> {
  const title = firstMessage.trim().slice(0, 60) || 'Nova conversa';
  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({ title, project_id: projectId })
    .select('id')
    .single();
  if (error) {
    console.error('Falha ao criar conversa no projeto:', error.message);
    return null;
  }
  return data?.id ?? null;
}
