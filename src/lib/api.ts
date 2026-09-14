export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ModelInfo {
  id: string;
  provider: string;
  label: string;
  goodFor: string;
}

export async function fetchModels(): Promise<ModelInfo[]> {
  const res = await fetch('/api/models');
  if (!res.ok) return [];
  const data = await res.json();
  return data.models ?? [];
}

export type FinishReason = 'stop' | 'length' | 'aborted' | 'unknown';

/** Envia a conversa e vai chamando onToken(texto) conforme os pedaços chegam (streaming). */
export async function streamChatCompletion(opts: {
  messages: ApiMessage[];
  modelId: string;
  mode: 'chat' | 'cowork' | 'design';
  onToken: (text: string) => void;
  signal?: AbortSignal;
  /** Token de sessão do Supabase (session.access_token), usado pelo servidor
   *  para identificar o usuário — necessário para o painel admin poder banir
   *  contas e para os logs de uso por provedor. Opcional: sem ele o pedido
   *  ainda funciona, só não fica atribuído a um usuário. */
  accessToken?: string;
  /** true quando essa chamada é um "continuar gerando" de uma resposta anterior cortada. */
  continuation?: boolean;
  /** Instruções persistentes do Projeto ao qual a conversa pertence (item 2 do backlog),
   *  somadas ao system prompt do modo. Vem do cliente porque é ele quem já carregou o
   *  projeto (com RLS) ao abrir a conversa — evita o servidor ter que buscar de novo. */
  projectInstructions?: string;
}): Promise<{ error?: string; limitReached?: boolean; finishReason?: FinishReason }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;

  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: opts.messages,
        modelId: opts.modelId,
        mode: opts.mode,
        continuation: opts.continuation,
        projectInstructions: opts.projectInstructions,
      }),
      signal: opts.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      // Usuário clicou em "Parar" — não é um erro, só interrompe o stream.
      return { finishReason: 'aborted' };
    }
    return { error: err?.message || 'Falha de conexão ao falar com a IA.' };
  }

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    return { error: data.error || `Erro ${res.status} ao falar com a IA.`, limitReached: data.limitReached };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let error: string | undefined;
  let finishReason: FinishReason | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const raw = trimmed.slice(5).trim();
        try {
          const json = JSON.parse(raw);
          if (json.token) opts.onToken(json.token);
          if (json.error) error = json.error;
          if (json.finishReason) finishReason = json.finishReason;
        } catch {
          /* ignora */
        }
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { finishReason: 'aborted' };
    }
    return { error: err?.message || 'Conexão interrompida.' };
  }

  return { error, finishReason };
}

export async function deepSearch(query: string) {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha na busca.');
  return data as { answer: string | null; results: { title: string; url: string; content: string }[] };
}

export async function browsePage(url: string) {
  const res = await fetch('/api/browse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao navegar.');
  return data as { title: string; url: string; text: string };
}

export interface ProjectFile {
  path: string;
  content: string;
}

export async function pushToGithub(opts: { owner?: string; repo?: string; branch?: string; files: ProjectFile[] }) {
  const res = await fetch('/api/github/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao enviar para o GitHub.');
  return data as { results: { path: string; ok: boolean; error?: string }[]; repoUrl: string };
}

export async function downloadZip(files: ProjectFile[], projectName = 'nexus-project') {
  const res = await fetch('/api/files/zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, projectName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Falha ao gerar o .zip.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function createCheckoutSession(plan: 'monthly' | 'yearly', email?: string, userId?: string) {
  const res = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, email, userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao iniciar o checkout.');
  return data as { url: string };
}

export interface SandboxRunResult {
  language: string;
  version: string;
  compile: { stdout: string; stderr: string; code: number | null } | null;
  run: { stdout: string; stderr: string; code: number | null };
}

/** Executa código num sandbox isolado (Piston) e devolve stdout/stderr/código de saída. */
export async function runCode(language: string, code: string, stdin?: string): Promise<SandboxRunResult> {
  const res = await fetch('/api/sandbox/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, code, stdin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Falha ao executar o código no sandbox.');
  return data as SandboxRunResult;
}

/** Extrai blocos ```lang:caminho/arquivo.ext ... ``` da resposta da IA (usado no modo Cowork). */
export function extractProjectFiles(content: string): ProjectFile[] {
  const regex = /```(\w+):([^\n]+)\n([\s\S]*?)```/g;
  const files: ProjectFile[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content))) {
    files.push({ path: match[2].trim(), content: match[3] });
  }
  return files;
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', tsx: 'tsx', jsx: 'jsx',
  python: 'py', py: 'py', json: 'json', html: 'html', css: 'css', bash: 'sh', sh: 'sh',
  shell: 'sh', java: 'java', go: 'go', rust: 'rs', rb: 'rb', ruby: 'rb', php: 'php',
  csharp: 'cs', cs: 'cs', sql: 'sql', yaml: 'yml', yml: 'yml', markdown: 'md', md: 'md',
};

/** Extrai blocos de código "simples" (```lang ... ``` sem caminho) da resposta da IA no
 *  modo Chat normal — usado pra virarem Artefatos automaticamente, já que nesse modo o
 *  prompt não pede o formato com caminho de arquivo (isso é só do Cowork). Ignora blocos
 *  muito curtos (prováveis um-liners que não valem virar artefato) e nomeia cada um
 *  sequencialmente, já que não há um caminho de arquivo dado pela IA. */
export function extractPlainSnippets(content: string): ProjectFile[] {
  const withPath = /```(\w+):([^\n]+)\n[\s\S]*?```/g;
  // Remove primeiro os blocos que já têm caminho, pra não contar duas vezes.
  const withoutPathBlocks = content.replace(withPath, '');
  const regex = /```(\w+)\n([\s\S]*?)```/g;
  const snippets: ProjectFile[] = [];
  let match: RegExpExecArray | null;
  let counter = 0;
  while ((match = regex.exec(withoutPathBlocks))) {
    const [, lang, body] = match;
    const lineCount = body.trim().split('\n').length;
    if (lineCount < 4) continue; // um-liners não viram artefato
    counter += 1;
    const ext = LANGUAGE_EXTENSIONS[lang.toLowerCase()] || 'txt';
    snippets.push({ path: `trecho-${counter}.${ext}`, content: body });
  }
  return snippets;
}
