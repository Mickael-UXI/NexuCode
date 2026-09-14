import { FormEvent, useState } from 'react';
import { ArrowLeft, LoaderCircle, ShieldCheck } from 'lucide-react';

interface AdminLoginProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function AdminLogin({ onBack, onSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha no login.');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-text-dim hover:text-text-main transition-colors mb-10">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao início
        </button>

        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-text-main flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-bg" strokeWidth={1.5} />
          </div>
        </div>

        <div className="border border-border rounded-xl bg-surface/50 p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-medium mb-2">Painel administrativo</h1>
            <p className="text-sm text-text-dim">Acesso restrito à equipe da Nexucode.</p>
          </div>

          {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="admin-email" className="block text-xs text-text-faint mb-2">Email</label>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@nexucode.com"
                className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-sm text-text-main placeholder:text-text-faint focus:border-accent/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-xs text-text-faint mb-2">Senha</label>
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-sm text-text-main focus:border-accent/50 focus:outline-none transition-colors"
              />
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center disabled:opacity-60">
              {isLoading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : null}
              Entrar como admin
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
