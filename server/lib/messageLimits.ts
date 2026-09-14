import { getSupabaseAdmin } from './supabaseAdmin.js';
import { env } from './env.js';

export interface MessageLimitStatus {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
}

/**
 * Verifica quantas mensagens (role='user') o usuário já enviou hoje (UTC) e
 * compara com o limite diário do plano free. Se o Supabase não estiver
 * configurado, ou a consulta falhar, libera por padrão (fail-open) — nunca
 * bloqueia o usuário por causa de um problema de infra nosso.
 */
export async function checkFreeMessageLimit(userId: string): Promise<MessageLimitStatus> {
  const limit = env.FREE_DAILY_MESSAGE_LIMIT;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return { allowed: true, limit, used: 0, remaining: limit };

  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);

  try {
    const { count, error } = await supabaseAdmin
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', startOfDayUtc.toISOString());

    if (error) return { allowed: true, limit, used: 0, remaining: limit };

    const used = count ?? 0;
    return { allowed: used < limit, limit, used, remaining: Math.max(0, limit - used) };
  } catch {
    return { allowed: true, limit, used: 0, remaining: limit };
  }
}
