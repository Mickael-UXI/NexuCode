import { env } from './env.js';
import type { ProviderId } from './modelRegistry.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type OnToken = (text: string) => void;

/** Motivo pelo qual o provedor parou de gerar — usado pra saber se dá pra oferecer "continuar gerando". */
export type FinishReason = 'stop' | 'length' | 'aborted' | 'unknown';

function normalizeFinishReason(raw: string | null | undefined): FinishReason {
  if (!raw) return 'unknown';
  const r = raw.toLowerCase();
  if (r === 'length' || r === 'max_tokens') return 'length';
  if (r === 'stop' || r === 'end_turn' || r === 'stop_sequence') return 'stop';
  return 'unknown';
}

/** Lê um stream SSE genérico (linhas "data: {...}") e chama parseLine pra cada evento. */
async function readSSE(body: ReadableStream<Uint8Array>, parseLine: (data: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      parseLine(data);
    }
  }
}

/**
 * OpenAI, Groq e DeepSeek falam o mesmo formato "chat/completions" — reaproveita a mesma função.
 *
 * Prompt caching aqui: a OpenAI (e provedores compatíveis) faz cache automático
 * no servidor deles para prompts acima de ~1024 tokens, sem precisar de nenhum
 * parâmetro extra — só exige que o início da requisição (aqui, a mensagem de
 * "system" seguida do histórico, na mesma ordem) seja idêntico entre chamadas,
 * o que já é o nosso caso. Nada a mudar no código além de manter essa ordem estável.
 */
async function streamOpenAICompatible(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  onToken: OnToken;
}): Promise<FinishReason> {
  const res = await fetch(`${opts.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      stream: true,
      messages: [{ role: 'system', content: opts.system }, ...opts.messages],
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Provedor retornou ${res.status}: ${await res.text().catch(() => '')}`);
  }
  let finishReason: FinishReason = 'unknown';
  await readSSE(res.body, (data) => {
    try {
      const json = JSON.parse(data);
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) opts.onToken(delta);
      const rawFinish = json.choices?.[0]?.finish_reason;
      if (rawFinish) finishReason = normalizeFinishReason(rawFinish);
    } catch {
      /* ignora linhas parciais/keep-alive */
    }
  });
  return finishReason;
}

async function streamAnthropic(opts: {
  model: string;
  system: string;
  messages: ChatMessage[];
  onToken: OnToken;
}): Promise<FinishReason> {
  // Prompt caching (Anthropic): marcamos o system prompt (idêntico em toda
  // chamada do mesmo modo chat/cowork) e a última mensagem do histórico atual
  // com cache_control. Na próxima chamada dessa mesma conversa, tudo até esse
  // ponto já está em cache — só o(s) token(s) novo(s) no fim são cobrados/processados
  // como entrada "fresca". Blocos curtos (abaixo do mínimo de ~1024 tokens do
  // modelo) simplesmente não geram cache, sem erro — então é seguro marcar sempre.
  // Não precisa de header "anthropic-beta": cache_control já funciona no endpoint
  // padrão. O cache "ephemeral" expira em 5 min por padrão — ótimo pra troca rápida
  // de mensagens; se a conversa costuma ter pausas mais longas, dá pra trocar por
  // `cache_control: { type: 'ephemeral', ttl: '1h' }` (custa um pouco mais na escrita).
  const cachedMessages = opts.messages.map((m, i) => ({
    role: m.role,
    content: [
      {
        type: 'text',
        text: m.content,
        ...(i === opts.messages.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
      },
    ],
  }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 4096,
      system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
      stream: true,
      messages: cachedMessages,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Anthropic retornou ${res.status}: ${await res.text().catch(() => '')}`);
  }
  let finishReason: FinishReason = 'unknown';
  await readSSE(res.body, (data) => {
    try {
      const json = JSON.parse(data);
      if (json.type === 'content_block_delta' && json.delta?.text) {
        opts.onToken(json.delta.text);
      }
      if (json.type === 'message_delta' && json.delta?.stop_reason) {
        finishReason = normalizeFinishReason(json.delta.stop_reason);
      }
    } catch {
      /* ignora */
    }
  });
  return finishReason;
}

async function streamGemini(opts: {
  model: string;
  system: string;
  messages: ChatMessage[];
  onToken: OnToken;
}): Promise<FinishReason> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: opts.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Gemini retornou ${res.status}: ${await res.text().catch(() => '')}`);
  }
  let finishReason: FinishReason = 'unknown';
  await readSSE(res.body, (data) => {
    try {
      const json = JSON.parse(data);
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) opts.onToken(text);
      const rawFinish = json.candidates?.[0]?.finishReason;
      if (rawFinish) finishReason = normalizeFinishReason(rawFinish);
    } catch {
      /* ignora */
    }
  });
  return finishReason;
}

/**
 * Ponto único de entrada: envia a conversa pro provedor/modelo escolhido e vai
 * chamando onToken(texto) conforme os pedaços chegam (streaming real).
 * Devolve o motivo da parada, usado pelo front pra oferecer "Continuar gerando".
 */
export async function streamChat(params: {
  provider: ProviderId;
  model: string;
  system: string;
  messages: ChatMessage[];
  onToken: OnToken;
}): Promise<FinishReason> {
  const { provider, model, system, messages, onToken } = params;

  switch (provider) {
    case 'anthropic':
      if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada no .env');
      return streamAnthropic({ model, system, messages, onToken });

    case 'openai':
      if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada no .env');
      return streamOpenAICompatible({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: env.OPENAI_API_KEY,
        model,
        system,
        messages,
        onToken,
      });

    case 'groq':
      if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY não configurada no .env');
      return streamOpenAICompatible({
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: env.GROQ_API_KEY,
        model,
        system,
        messages,
        onToken,
      });

    case 'deepseek':
      if (!env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY não configurada no .env');
      return streamOpenAICompatible({
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: env.DEEPSEEK_API_KEY,
        model,
        system,
        messages,
        onToken,
      });

    case 'gemini':
      if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada no .env');
      return streamGemini({ model, system, messages, onToken });

    case 'nvidia':
      // Catálogo NIM da NVIDIA (inclui os modelos Nemotron) fala o mesmo formato
      // "chat/completions" da OpenAI — mesma função de streaming reaproveitada.
      if (!env.NVIDIA_API_KEY) throw new Error('NVIDIA_API_KEY não configurada no .env');
      return streamOpenAICompatible({
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        apiKey: env.NVIDIA_API_KEY,
        model,
        system,
        messages,
        onToken,
      });

    default:
      throw new Error(`Provedor desconhecido: ${provider}`);
  }
}
