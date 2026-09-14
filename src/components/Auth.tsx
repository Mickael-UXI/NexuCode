import { FormEvent, useState } from 'react';
import { ArrowLeft, Check, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AuthProps {
  onBack: () => void;
  /** Chamado explicitamente logo após um login (ou cadastro que já vem com sessão) bem-sucedido,
   *  pra navegar direto pro chat sem depender só do listener global onAuthStateChange do App.tsx
   *  (que pode disparar com atraso, ou nem disparar a tempo em alguns casos). */
  onSuccess?: () => void;
}

export default function Auth({ onBack, onSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setIsLoading(false);

    if (result.error) {
      setError(mode === 'login'
        ? 'Não foi possível entrar. Confira seu email e senha.'
        : 'Não foi possível criar sua conta. Tente novamente.');
      return;
    }

    if (mode === 'signup' && !result.data.session) {
      // Supabase exige confirmação de e-mail antes de abrir sessão — não há pra onde
      // redirecionar ainda, então deixamos claro o próximo passo em vez de tentar navegar.
      setSuccess('Conta criada. Verifique seu e-mail para confirmar o cadastro e depois entre com seu email e senha.');
      setMode('login');
      setPassword('');
      return;
    }

    setSuccess('Acesso confirmado.');
    // Login (ou cadastro sem confirmação de e-mail) resultou em sessão ativa: navega
    // direto, sem esperar o listener global do App.tsx.
    if (result.data.session) onSuccess?.();
  };

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-text-dim hover:text-text-main transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao início
        </button>

        <div className="flex justify-center mb-8">
          <img src="/nexuimg.webp" alt="Nexus Code" className="w-20 h-20 object-contain" />
        </div>

        <div className="border border-border rounded-xl bg-surface/50 p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-medium mb-2">
              {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h1>
            <p className="text-sm text-text-dim">
              {mode === 'login'
                ? 'Entre para continuar sua conversa com o Nexus Agent.'
                : 'Crie uma conta gratuita para usar o Nexus Agent.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex gap-2 items-start">
              <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs text-text-faint mb-2">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@email.com"
                className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-sm text-text-main placeholder:text-text-faint focus:border-accent/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs text-text-faint mb-2">Senha</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full bg-bg border border-border rounded-lg px-4 py-3 pr-11 text-sm text-text-main placeholder:text-text-faint focus:border-accent/50 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-main"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center disabled:opacity-60"
            >
              {isLoading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : null}
              {mode === 'login' ? 'Entrar no chat' : 'Criar conta'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <span className="text-sm text-text-dim">
              {mode === 'login' ? 'Ainda não tem uma conta?' : 'Já tem uma conta?'}
            </span>{' '}
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
                setSuccess('');
              }}
              className="text-sm font-medium text-accent hover:underline"
            >
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-text-faint mt-6">
          Ao continuar, você concorda com nossos termos de uso e política de privacidade.
        </p>
      </div>
    </main>
  );
}
