import { getSupabaseAdmin } from './supabaseAdmin.js';

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface Profile {
  id: string;
  email: string | null;
  role: 'user' | 'admin';
  plan: 'free' | 'pro';
  banned: boolean;
}

/**
 * Lê o header "Authorization: Bearer <access_token>" (token de sessão do
 * Supabase, gerado no cliente) e devolve o usuário autenticado, se houver.
 * Retorna null silenciosamente quando não há token, o Supabase não está
 * configurado no servidor, ou o token é inválido/expirado — nesses casos o
 * chamador decide se trata a chamada como anônima ou rejeita.
 */
export async function getUserFromRequest(req: any): Promise<AuthUser | null> {
  const header = req.headers?.authorization as string | undefined;
  if (!header?.startsWith('Bearer ')) return null;

  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

/** Busca o perfil (plano, papel, status de banimento) de um usuário pelo id. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role, plan, banned')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Profile;
}
