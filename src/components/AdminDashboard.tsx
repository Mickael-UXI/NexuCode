import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, LoaderCircle, LogOut, MessageSquare, ShieldCheck, Users } from 'lucide-react';

interface AdminDashboardProps {
  onLogout: () => void;
}

interface Stats {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  bannedUsers: number;
  error?: string;
}

interface AdminUser {
  id: string;
  email: string | null;
  role: 'user' | 'admin';
  plan: 'free' | 'pro';
  banned: boolean;
  banned_at: string | null;
  created_at: string;
}

interface Conversation {
  id: string;
  user_id: string;
  userEmail: string | null;
  title: string;
  updated_at: string;
}

interface UsageRow {
  provider: string;
  success: number;
  error: number;
  total: number;
}

interface ErrorLog {
  id: string;
  userEmail: string | null;
  provider: string;
  model: string;
  mode: string;
  error_message: string | null;
  created_at: string;
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' });
  return res.json();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [email, setEmail] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [statsRes, usersRes, conversationsRes, usageRes, errorsRes] = await Promise.all([
      adminGet<Stats>('/api/admin/stats'),
      adminGet<{ users?: AdminUser[]; error?: string }>('/api/admin/users'),
      adminGet<{ conversations?: Conversation[]; error?: string }>('/api/admin/conversations'),
      adminGet<{ usage?: UsageRow[]; error?: string }>('/api/admin/usage?days=7'),
      adminGet<{ errors?: ErrorLog[]; error?: string }>('/api/admin/errors?limit=20'),
    ]);

    const firstError = statsRes.error || usersRes.error || conversationsRes.error || usageRes.error || errorsRes.error;
    setConfigError(firstError ?? '');

    setStats(statsRes);
    setUsers(usersRes.users ?? []);
    setConversations(conversationsRes.conversations ?? []);
    setUsage(usageRes.usage ?? []);
    setErrors(errorsRes.errors ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setEmail(d.email || ''));
    loadAll();
  }, [loadAll]);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    onLogout();
  };

  const toggleBan = async (user: AdminUser) => {
    setPendingUserId(user.id);
    await fetch(`/api/admin/users/${user.id}/ban`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: !user.banned }),
    });
    await loadAll();
    setPendingUserId(null);
  };

  const changePlan = async (user: AdminUser, plan: 'free' | 'pro') => {
    if (plan === user.plan) return;
    setPendingUserId(user.id);
    await fetch(`/api/admin/users/${user.id}/plan`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    await loadAll();
    setPendingUserId(null);
  };

  const maxUsageTotal = Math.max(1, ...usage.map((u) => u.total));

  return (
    <main className="min-h-screen bg-bg px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={onLogout} className="inline-flex items-center gap-2 text-sm text-text-dim hover:text-text-main transition-colors mb-4">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao site
            </button>
            <h1 className="text-2xl font-medium">Painel administrativo</h1>
            <p className="text-sm text-text-faint">{email}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-text-dim hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>

        {configError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {configError}
          </div>
        )}

        {loading && !stats ? (
          <div className="flex items-center justify-center py-20 text-text-faint">
            <LoaderCircle className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <div className="space-y-10">
            {/* Cards de estatísticas */}
            <section className="grid sm:grid-cols-4 gap-4">
              <StatCard icon={<Users className="w-4 h-4" />} label="Usuários" value={stats?.totalUsers ?? '—'} />
              <StatCard icon={<ShieldCheck className="w-4 h-4" />} label="Plano Pro" value={stats?.proUsers ?? '—'} />
              <StatCard icon={<Users className="w-4 h-4" />} label="Plano Free" value={stats?.freeUsers ?? '—'} />
              <StatCard icon={<Ban className="w-4 h-4" />} label="Banidos" value={stats?.bannedUsers ?? '—'} />
            </section>

            {/* Uso por provedor de IA */}
            <section className="border border-border rounded-xl bg-surface/50 p-6">
              <h2 className="text-sm font-medium mb-4">Uso por provedor de IA (últimos 7 dias)</h2>
              {usage.length === 0 ? (
                <p className="text-sm text-text-faint">Nenhuma chamada registrada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {usage.map((row) => (
                    <div key={row.provider}>
                      <div className="flex justify-between text-xs text-text-dim mb-1">
                        <span className="capitalize">{row.provider}</span>
                        <span>
                          {row.total} chamadas{row.error > 0 ? ` · ${row.error} erro(s)` : ''}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${(row.total / maxUsageTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Usuários */}
            <section className="border border-border rounded-xl bg-surface/50 p-6">
              <h2 className="text-sm font-medium mb-4">Usuários</h2>
              {users.length === 0 ? (
                <p className="text-sm text-text-faint">Nenhum usuário encontrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-text-faint uppercase tracking-wider border-b border-border">
                        <th className="pb-2 pr-4">Email</th>
                        <th className="pb-2 pr-4">Plano</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4">Criado em</th>
                        <th className="pb-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-border/60 last:border-0">
                          <td className="py-2 pr-4 text-text-main">{user.email ?? user.id}</td>
                          <td className="py-2 pr-4">
                            <select
                              value={user.plan}
                              disabled={pendingUserId === user.id}
                              onChange={(e) => changePlan(user, e.target.value as 'free' | 'pro')}
                              className="bg-bg border border-border rounded-md px-2 py-1 text-xs disabled:opacity-50"
                            >
                              <option value="free">free</option>
                              <option value="pro">pro</option>
                            </select>
                          </td>
                          <td className="py-2 pr-4">
                            {user.banned ? (
                              <span className="inline-flex items-center gap-1 text-red-600 text-xs">
                                <Ban className="w-3 h-3" /> Banido
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                                <CheckCircle2 className="w-3 h-3" /> Ativo
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-text-faint text-xs">{formatDate(user.created_at)}</td>
                          <td className="py-2">
                            <button
                              onClick={() => toggleBan(user)}
                              disabled={pendingUserId === user.id}
                              className={`text-xs px-3 py-1 rounded-md border transition-colors disabled:opacity-50 ${
                                user.banned
                                  ? 'border-green-200 text-green-700 hover:bg-green-50'
                                  : 'border-red-200 text-red-700 hover:bg-red-50'
                              }`}
                            >
                              {user.banned ? 'Reativar' : 'Banir'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Últimas conversas */}
            <section className="border border-border rounded-xl bg-surface/50 p-6">
              <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Últimas conversas
              </h2>
              {conversations.length === 0 ? (
                <p className="text-sm text-text-faint">
                  Nenhuma conversa persistida ainda. Isso passa a aparecer aqui quando o histórico de chat
                  for salvo no banco (tabela <code>chat_conversations</code>).
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {conversations.map((c) => (
                    <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                      <div>
                        <p className="text-text-main">{c.title}</p>
                        <p className="text-xs text-text-faint">{c.userEmail ?? c.user_id}</p>
                      </div>
                      <span className="text-xs text-text-faint">{formatDate(c.updated_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Log de erros de IA */}
            <section className="border border-border rounded-xl bg-surface/50 p-6">
              <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Erros recentes de chamadas de IA
              </h2>
              {errors.length === 0 ? (
                <p className="text-sm text-text-faint">Nenhum erro registrado.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {errors.map((e) => (
                    <li key={e.id} className="py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-text-main capitalize">
                          {e.provider} · {e.model}
                        </span>
                        <span className="text-xs text-text-faint">{formatDate(e.created_at)}</span>
                      </div>
                      <p className="text-xs text-red-600 mt-0.5">{e.error_message}</p>
                      {e.userEmail && <p className="text-xs text-text-faint">{e.userEmail}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="border border-border rounded-xl bg-surface/50 p-6">
      <div className="flex items-center gap-2 text-text-faint mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-medium text-text-main">{value}</p>
    </div>
  );
}
