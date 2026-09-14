import { getSupabaseAdmin } from './supabaseAdmin.js';

/**
 * Registra uma chamada a um provedor de IA (sucesso ou erro) na tabela
 * `ai_call_logs`, usada pelo painel admin (gráfico de uso por provedor e log
 * de erros). Nunca lança — se o Supabase não estiver configurado, ou a
 * escrita falhar, apenas ignora, para nunca quebrar a resposta ao usuário.
 */
export function logAiCall(params: {
  userId?: string | null;
  provider: string;
  model: string;
  mode: 'chat' | 'cowork' | 'design';
  status: 'success' | 'error';
  errorMessage?: string | null;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  supabaseAdmin
    .from('ai_call_logs')
    .insert({
      user_id: params.userId ?? null,
      provider: params.provider,
      model: params.model,
      mode: params.mode,
      status: params.status,
      error_message: params.errorMessage ? params.errorMessage.slice(0, 2000) : null,
    })
    .then(({ error }) => {
      if (error) console.error('Falha ao gravar ai_call_logs:', error.message);
    });
}
