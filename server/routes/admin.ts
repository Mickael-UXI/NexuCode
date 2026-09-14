import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../lib/env.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

export const adminRouter = Router();

const COOKIE_NAME = 'nexus_admin_token';

export function requireAdmin(req: any, res: any, next: any) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    req.admin = jwt.verify(token, env.ADMIN_JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sessão de admin inválida ou expirada.' });
  }
}

/** Devolve um erro padrão quando o Supabase (service role) não está configurado. */
function requireSupabase(res: any) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    res.status(400).json({ error: 'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env para usar este recurso.' });
    return null;
  }
  return supabaseAdmin;
}

/** Login separado do login normal de usuários (Supabase). Usa credenciais próprias no .env. */
adminRouter.post('/admin/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH) {
    return res.status(400).json({
      error: 'Login admin não configurado. Defina ADMIN_EMAIL e gere ADMIN_PASSWORD_HASH com "npm run admin:hash".',
    });
  }

  if (email !== env.ADMIN_EMAIL) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }
  const ok = await bcrypt.compare(password || '', env.ADMIN_PASSWORD_HASH);
  if (!ok) return res.status(401).json({ error: 'Credenciais inválidas.' });

  const token = jwt.sign({ email }, env.ADMIN_JWT_SECRET, { expiresIn: '12h' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

adminRouter.post('/admin/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

adminRouter.get('/admin/me', requireAdmin, (req: any, res) => {
  res.json({ email: req.admin.email });
});

/** Estatísticas gerais pro topo do painel: total de usuários, split por plano e banidos. */
adminRouter.get('/admin/stats', requireAdmin, async (_req, res) => {
  const supabaseAdmin = requireSupabase(res);
  if (!supabaseAdmin) return;

  try {
    const [{ count: totalUsers }, { count: proUsers }, { count: bannedUsers }] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('banned', true),
    ]);

    res.json({
      totalUsers: totalUsers ?? 0,
      proUsers: proUsers ?? 0,
      freeUsers: (totalUsers ?? 0) - (proUsers ?? 0),
      bannedUsers: bannedUsers ?? 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao buscar estatísticas.' });
  }
});

/** Lista usuários (perfis) pro painel, mais recentes primeiro. */
adminRouter.get('/admin/users', requireAdmin, async (req, res) => {
  const supabaseAdmin = requireSupabase(res);
  if (!supabaseAdmin) return;

  const limit = Math.min(Number(req.query.limit) || 100, 500);

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, plan, banned, banned_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ users: data ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao listar usuários.' });
  }
});

/** Bane ou reativa um usuário. Isso bloqueia imediatamente o uso do chat/cowork (ver server/routes/chat.ts). */
adminRouter.post('/admin/users/:id/ban', requireAdmin, async (req, res) => {
  const supabaseAdmin = requireSupabase(res);
  if (!supabaseAdmin) return;

  const { banned } = req.body as { banned: boolean };

  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ banned: !!banned, banned_at: banned ? new Date().toISOString() : null })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao atualizar usuário.' });
  }
});

/** Define manualmente o plano de um usuário (fora do fluxo de checkout/webhook do Stripe). */
adminRouter.post('/admin/users/:id/plan', requireAdmin, async (req, res) => {
  const supabaseAdmin = requireSupabase(res);
  if (!supabaseAdmin) return;

  const { plan } = req.body as { plan: 'free' | 'pro' };
  if (plan !== 'free' && plan !== 'pro') {
    return res.status(400).json({ error: 'Plano inválido. Use "free" ou "pro".' });
  }

  try {
    const { error } = await supabaseAdmin.from('profiles').update({ plan }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao atualizar plano.' });
  }
});

/** Conversas mais recentes de todos os usuários (visão geral, sem conteúdo das mensagens). */
adminRouter.get('/admin/conversations', requireAdmin, async (req, res) => {
  const supabaseAdmin = requireSupabase(res);
  if (!supabaseAdmin) return;

  const limit = Math.min(Number(req.query.limit) || 20, 100);

  try {
    const { data: conversations, error } = await supabaseAdmin
      .from('chat_conversations')
      .select('id, user_id, title, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const userIds = [...new Set((conversations ?? []).map((c) => c.user_id))];
    let emailByUser: Record<string, string | null> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id, email').in('id', userIds);
      emailByUser = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.email]));
    }

    res.json({
      conversations: (conversations ?? []).map((c) => ({ ...c, userEmail: emailByUser[c.user_id] ?? null })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao listar conversas.' });
  }
});

/** Uso por provedor de IA nos últimos N dias (padrão 7), a partir de ai_call_logs. */
adminRouter.get('/admin/usage', requireAdmin, async (req, res) => {
  const supabaseAdmin = requireSupabase(res);
  if (!supabaseAdmin) return;

  const days = Math.min(Number(req.query.days) || 7, 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabaseAdmin
      .from('ai_call_logs')
      .select('provider, status')
      .gte('created_at', since)
      .limit(10000);
    if (error) throw error;

    const byProvider: Record<string, { success: number; error: number }> = {};
    for (const row of data ?? []) {
      const entry = (byProvider[row.provider] ??= { success: 0, error: 0 });
      if (row.status === 'success') entry.success += 1;
      else entry.error += 1;
    }

    res.json({
      days,
      usage: Object.entries(byProvider)
        .map(([provider, counts]) => ({ provider, ...counts, total: counts.success + counts.error }))
        .sort((a, b) => b.total - a.total),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao calcular uso por provedor.' });
  }
});

/** Log de erros mais recentes das chamadas de IA (chaves inválidas, provedor fora do ar, etc). */
adminRouter.get('/admin/errors', requireAdmin, async (req, res) => {
  const supabaseAdmin = requireSupabase(res);
  if (!supabaseAdmin) return;

  const limit = Math.min(Number(req.query.limit) || 50, 200);

  try {
    const { data: errors, error } = await supabaseAdmin
      .from('ai_call_logs')
      .select('id, user_id, provider, model, mode, error_message, created_at')
      .eq('status', 'error')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const userIds = [...new Set((errors ?? []).map((e) => e.user_id).filter(Boolean))] as string[];
    let emailByUser: Record<string, string | null> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id, email').in('id', userIds);
      emailByUser = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.email]));
    }

    res.json({
      errors: (errors ?? []).map((e) => ({ ...e, userEmail: e.user_id ? emailByUser[e.user_id] ?? null : null })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao listar erros.' });
  }
});
