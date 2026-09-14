import { useState } from 'react';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

interface ApiDocsProps {
  onNavigate: (page: 'home' | 'chat' | 'cowork' | 'docs' | 'api' | 'how-it-works') => void;
}

interface Endpoint {
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  auth?: boolean;
  body?: string;
  response?: string;
}

const endpoints: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/models',
    summary: 'Lista os modelos de IA disponíveis — só retorna provedores com chave configurada no servidor.',
    response: `{
  "models": [
    { "id": "claude-sonnet-5", "provider": "anthropic", "label": "Claude Sonnet 5", "goodFor": "Melhor equilíbrio entre velocidade e inteligência" }
  ]
}`,
  },
  {
    method: 'POST',
    path: '/api/chat',
    summary: 'Envia uma conversa para o modelo escolhido e recebe a resposta em streaming (Server-Sent Events).',
    auth: true,
    body: `{
  "messages": [{ "role": "user", "content": "Explique recursão em Python" }],
  "modelId": "claude-sonnet-5",
  "mode": "chat"
}`,
    response: `data: {"token":"Recur"}
data: {"token":"são é..."}
data: {"done":true,"finishReason":"stop"}`,
  },
  {
    method: 'POST',
    path: '/api/search',
    summary: 'Busca profunda na web (requer TAVILY_API_KEY no servidor) para dar contexto atual ao modelo.',
    body: `{ "query": "últimas versões do Node.js" }`,
  },
  {
    method: 'POST',
    path: '/api/browse',
    summary: 'Extrai o conteúdo de texto de uma URL para usar como contexto na conversa.',
    body: `{ "url": "https://exemplo.com/artigo" }`,
  },
  {
    method: 'GET',
    path: '/api/sandbox/runtimes',
    summary: 'Lista as linguagens e versões disponíveis para execução de código (via Piston).',
  },
  {
    method: 'POST',
    path: '/api/sandbox/run',
    summary: 'Executa um trecho de código no sandbox e devolve stdout/stderr.',
    body: `{ "language": "python", "code": "print('oi')" }`,
  },
  {
    method: 'POST',
    path: '/api/github/push',
    summary: 'Envia os arquivos montados no Cowork para um repositório GitHub (requer GITHUB_TOKEN).',
    auth: true,
    body: `{ "files": [{ "path": "src/index.ts", "content": "..." }], "message": "commit via Nexus Cowork" }`,
  },
  {
    method: 'POST',
    path: '/api/files/zip',
    summary: 'Empacota os arquivos do projeto atual em um .zip para download.',
    body: `{ "files": [{ "path": "src/index.ts", "content": "..." }] }`,
  },
  {
    method: 'GET',
    path: '/api/health',
    summary: 'Health check simples — devolve { "ok": true } quando o servidor está de pé.',
  },
];

const methodColor: Record<string, string> = {
  GET: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  POST: 'text-accent bg-accent-bg',
};

export default function ApiDocs({ onNavigate }: ApiDocsProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="min-h-screen bg-bg text-text-main">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => onNavigate('docs')} className="p-1.5 text-text-dim hover:text-text-main transition-colors">
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <span className="font-serif text-base font-medium">Referência da API</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="font-serif text-3xl font-medium mb-3">API do Nexus</h1>
        <p className="text-text-dim leading-relaxed mb-2">
          Todas as rotas ficam sob <code className="text-xs bg-surface-2 px-1.5 py-0.5 rounded">/api</code>, no
          mesmo servidor Express que serve o site. Rotas marcadas como <strong className="text-text-main">autenticadas</strong> esperam
          o token de sessão do Supabase (o front já envia isso automaticamente).
        </p>
        <p className="text-text-dim leading-relaxed mb-10">
          Esta é uma API interna do produto — pensada para o próprio frontend do Nexus, não uma API pública com
          chave própria para terceiros.
        </p>

        <div className="space-y-6">
          {endpoints.map((ep) => {
            const key = ep.method + ep.path;
            return (
              <div key={key} className="rounded-xl border border-border overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-surface/60 border-b border-border">
                  <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${methodColor[ep.method]}`}>
                    {ep.method}
                  </span>
                  <code className="text-sm font-mono text-text-main">{ep.path}</code>
                  {ep.auth && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-text-faint border border-border rounded px-1.5 py-0.5">
                      autenticado
                    </span>
                  )}
                </div>
                <div className="px-4 py-3 space-y-3">
                  <p className="text-sm text-text-dim">{ep.summary}</p>
                  {ep.body && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] uppercase tracking-wide text-text-faint">Corpo da requisição</span>
                        <button onClick={() => copy(ep.body!, key + '-body')} className="text-text-faint hover:text-accent transition-colors">
                          {copied === key + '-body' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <pre className="code-block px-3 py-2.5 text-xs overflow-x-auto"><code>{ep.body}</code></pre>
                    </div>
                  )}
                  {ep.response && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] uppercase tracking-wide text-text-faint">Resposta</span>
                        <button onClick={() => copy(ep.response!, key + '-res')} className="text-text-faint hover:text-accent transition-colors">
                          {copied === key + '-res' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <pre className="code-block px-3 py-2.5 text-xs overflow-x-auto"><code>{ep.response}</code></pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
