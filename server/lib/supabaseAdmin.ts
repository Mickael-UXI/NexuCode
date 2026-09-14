import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

let client: SupabaseClient | null | undefined;

/** Cliente com a service role key — só usar no servidor, nunca expor ao browser. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    client = null;
    return client;
  }
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
