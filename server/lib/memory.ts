import { getSupabaseAdmin } from './supabaseAdmin.js';
import { streamChat } from './providers.js';
import { listAvailableModels } from './modelRegistry.js';

export interface MemoryNote {
  id: string;
  content: string;
  created_at: string;
}

const MAX_NOTES_IN_PROMPT = 30;

/** Busca os fatos guardados sobre o usuário e monta o bloco a somar ao system prompt.
 *  Retorna string vazia se não houver Supabase configurado, usuário anônimo, ou nada guardado. */
export async function getMemoryContext(userId: string | undefined): Promise<string> {
  if (!userId) return '';
  const notes = await listMemoryNotes(userId);
  if (notes.length === 0) return '';

  const bullet = notes
    .slice(0, MAX_NOTES_IN_PROMPT)
    .map((n) => `- ${n.content}`)
    .join('\n');

  return `\n\nMEMÓRIA (fatos e preferências que você já aprendeu sobre este usuário em conversas anteriores — use quando forem relevantes para a resposta atual, mas não force menção a eles se não vierem ao caso):\n${bullet}`;
}

export async function listMemoryNotes(userId: string): Promise<MemoryNote[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from('user_memory')
    .select('id, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('Falha ao listar memória:', error.message);
    return [];
  }
  return data ?? [];
}

export async function addMemoryNote(userId: string, content: string, conversationId?: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const trimmed = content.trim();
  if (!trimmed) return;

  // Evita duplicar um fato muito parecido com um já guardado.
  const existing = await listMemoryNotes(userId);
  const normalized = trimmed.toLowerCase();
  if (existing.some((n) => n.content.trim().toLowerCase() === normalized)) return;

  const { error } = await admin
    .from('user_memory')
    .insert({ user_id: userId, content: trimmed, source_conversation_id: conversationId ?? null });
  if (error) console.error('Falha ao salvar memória:', error.message);
}

export async function deleteMemoryNote(userId: string, id: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { error } = await admin.from('user_memory').delete().eq('id', id).eq('user_id', userId);
  if (error) {
    console.error('Falha ao apagar memória:', error.message);
    return false;
  }
  return true;
}

const EXTRACTION_SYSTEM = `Você extrai fatos duráveis sobre um usuário a partir de UM turno de conversa
(mensagem do usuário + resposta da IA). Um fato durável é algo que provavelmente ainda será
verdade daqui a semanas: preferências de linguagem/framework, nome, profissão, projetos em
andamento, restrições ("sempre usa TypeScript", "não gosta de respostas longas"), contexto
recorrente. NÃO extraia: perguntas pontuais, informação genérica que não é sobre o usuário,
nem nada que já pareça um fato passageiro (humor do momento, algo só válido para esta mensagem).

Responda APENAS com um JSON array de strings curtas (uma frase cada, em português, na terceira
pessoa, ex.: "Prefere respostas em TypeScript"). Se não houver nenhum fato novo digno de guardar,
responda exatamente: []. Nunca inclua texto fora do array JSON.`;

/** Roda em segundo plano (fire-and-forget) depois de uma resposta: manda o turno pra um
 *  modelo barato extrair 0-3 fatos novos e guarda os que ainda não estavam salvos. Nunca
 *  deve travar nem afetar a resposta que o usuário já recebeu. */
export function extractMemoryInBackground(opts: {
  userId: string | undefined;
  conversationId?: string;
  userMessage: string;
  assistantMessage: string;
}): void {
  if (!opts.userId) return;
  if (!getSupabaseAdmin()) return;

  const models = listAvailableModels();
  const model = models.find((m) => m.id.includes('haiku')) ?? models[0];
  if (!model) return;

  const turn = `Usuário: ${opts.userMessage.slice(0, 2000)}\n\nIA: ${opts.assistantMessage.slice(0, 2000)}`;

  (async () => {
    try {
      let buffer = '';
      await streamChat({
        provider: model.provider,
        model: model.id,
        system: EXTRACTION_SYSTEM,
        messages: [{ role: 'user', content: turn }],
        onToken: (text) => {
          buffer += text;
        },
      });

      const jsonStart = buffer.indexOf('[');
      const jsonEnd = buffer.lastIndexOf(']');
      if (jsonStart === -1 || jsonEnd === -1) return;

      const parsed = JSON.parse(buffer.slice(jsonStart, jsonEnd + 1));
      if (!Array.isArray(parsed)) return;

      for (const fact of parsed) {
        if (typeof fact === 'string' && fact.trim()) {
          await addMemoryNote(opts.userId!, fact, opts.conversationId);
        }
      }
    } catch (err) {
      // Extração de memória é um "nice to have" — nunca deve gerar ruído nos logs principais.
      console.error('Falha ao extrair memória em segundo plano:', err);
    }
  })();
}
