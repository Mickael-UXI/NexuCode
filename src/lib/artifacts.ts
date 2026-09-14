import { supabase } from '@/lib/supabase';
import { extractProjectFiles, extractPlainSnippets } from '@/lib/api';

export interface Artifact {
  id: string;
  conversation_id: string;
  mode: 'chat' | 'cowork';
  title: string;
  language: string | null;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ArtifactVersion {
  version: number;
  content: string;
  created_at: string;
}

function languageFromTitle(title: string): string {
  const ext = title.split('.').pop()?.toLowerCase() ?? '';
  return ext || 'text';
}

/** Lista todos os artefatos do usuário, mais recentes primeiro — a aba/painel de Artefatos. */
export async function listArtifacts(): Promise<Artifact[]> {
  const { data, error } = await supabase
    .from('artifacts')
    .select('id, conversation_id, mode, title, language, content, version, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('Falha ao listar artefatos:', error.message);
    return [];
  }
  return data ?? [];
}

export async function listArtifactsForConversation(conversationId: string): Promise<Artifact[]> {
  const { data, error } = await supabase
    .from('artifacts')
    .select('id, conversation_id, mode, title, language, content, version, created_at, updated_at')
    .eq('conversation_id', conversationId)
    .order('title', { ascending: true });
  if (error) {
    console.error('Falha ao listar artefatos da conversa:', error.message);
    return [];
  }
  return data ?? [];
}

/** Histórico completo de versões de um artefato, mais recente primeiro. */
export async function getArtifactVersions(artifactId: string): Promise<ArtifactVersion[]> {
  const { data, error } = await supabase
    .from('artifact_versions')
    .select('version, content, created_at')
    .eq('artifact_id', artifactId)
    .order('version', { ascending: false });
  if (error) {
    console.error('Falha ao carregar versões do artefato:', error.message);
    return [];
  }
  return data ?? [];
}

export async function deleteArtifact(id: string): Promise<boolean> {
  const { error } = await supabase.from('artifacts').delete().eq('id', id);
  if (error) {
    console.error('Falha ao apagar artefato:', error.message);
    return false;
  }
  return true;
}

/** Cria o artefato (se ainda não existir, pela combinação conversa+título) ou grava uma
 *  nova versão dele (se o conteúdo mudou). Fica no ar como histórico completo em
 *  `artifact_versions`, atendendo ao critério de aceite de "editável/iterável, com
 *  histórico de versões". */
async function upsertArtifact(
  conversationId: string,
  mode: 'chat' | 'cowork',
  title: string,
  content: string
): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from('artifacts')
    .select('id, version, content')
    .eq('conversation_id', conversationId)
    .eq('title', title)
    .maybeSingle();

  if (findError) {
    console.error('Falha ao verificar artefato existente:', findError.message);
    return;
  }

  if (existing) {
    if (existing.content === content) return; // sem mudança, não cria versão à toa
    const nextVersion = existing.version + 1;
    const { error: updateError } = await supabase
      .from('artifacts')
      .update({ content, version: nextVersion, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (updateError) {
      console.error('Falha ao atualizar artefato:', updateError.message);
      return;
    }
    const { error: versionError } = await supabase
      .from('artifact_versions')
      .insert({ artifact_id: existing.id, version: nextVersion, content });
    if (versionError) console.error('Falha ao salvar versão do artefato:', versionError.message);
    return;
  }

  const { data: created, error: insertError } = await supabase
    .from('artifacts')
    .insert({ conversation_id: conversationId, mode, title, language: languageFromTitle(title), content, version: 1 })
    .select('id')
    .single();
  if (insertError || !created) {
    console.error('Falha ao criar artefato:', insertError?.message);
    return;
  }
  const { error: versionError } = await supabase
    .from('artifact_versions')
    .insert({ artifact_id: created.id, version: 1, content });
  if (versionError) console.error('Falha ao salvar versão inicial do artefato:', versionError.message);
}

/** Varre o conteúdo de uma resposta da IA em busca de blocos de código/arquivo e
 *  sincroniza cada um como Artefato. Chamado ao final do streaming (não a cada token,
 *  pra não sobrecarregar o banco com escritas). Silencioso e best-effort: falhas aqui
 *  nunca devem interromper a conversa. */
export async function syncArtifactsFromContent(
  conversationId: string | null,
  mode: 'chat' | 'cowork',
  content: string
): Promise<void> {
  if (!conversationId || !content) return;
  const files = mode === 'cowork' ? extractProjectFiles(content) : extractPlainSnippets(content);
  for (const file of files) {
    await upsertArtifact(conversationId, mode, file.path, file.content);
  }
}
