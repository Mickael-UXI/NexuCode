import { hasProvider } from './env.js';

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'groq' | 'deepseek' | 'nvidia';

export interface ModelInfo {
  id: string;
  provider: ProviderId;
  label: string;
  goodFor: string;
}

export const MODEL_REGISTRY: ModelInfo[] = [
  // Anthropic — nomes de modelo atuais em set/2026 (ver docs.claude.com/en/docs/about-claude/models).
  { id: 'claude-opus-5', provider: 'anthropic', label: 'Claude Opus 5', goodFor: 'Coding agêntico complexo e tarefas enterprise' },
  { id: 'claude-sonnet-5', provider: 'anthropic', label: 'Claude Sonnet 5', goodFor: 'Melhor equilíbrio entre velocidade e inteligência' },
  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', label: 'Claude Haiku 4.5', goodFor: 'O mais rápido, ótimo custo-benefício' },
  // OpenAI — família GPT-5.6 (GA desde jul/2026) + GPT-6 Astra (flagship, lançado set/2026).
  { id: 'gpt-6-astra', provider: 'openai', label: 'GPT-6 Astra', goodFor: 'O modelo mais capaz da OpenAI' },
  { id: 'gpt-5.6-terra', provider: 'openai', label: 'GPT-5.6 Terra', goodFor: 'Equilíbrio entre inteligência e custo' },
  { id: 'gpt-5.6-luna', provider: 'openai', label: 'GPT-5.6 Luna', goodFor: 'Rápido e barato, alto volume' },
  // Gemini — família Gemini 3.
  { id: 'gemini-3-pro-preview', provider: 'gemini', label: 'Gemini 3 Pro', goodFor: 'Contexto gigante, raciocínio e visão' },
  { id: 'gemini-3.8-flash', provider: 'gemini', label: 'Gemini 3.8 Flash', goodFor: 'Respostas rápidas e agentes de código' },
  // Groq — llama-3.3-70b-versatile foi descontinuado pela Groq em 16/08/2026;
  // gpt-oss-120b é a substituição recomendada oficialmente.
  { id: 'openai/gpt-oss-120b', provider: 'groq', label: 'GPT-OSS 120B (Groq)', goodFor: 'Velocidade extrema (hardware Groq)' },
  // DeepSeek — deepseek-chat/deepseek-reasoner foram desativados em 24/07/2026; usar os IDs da V4 diretamente.
  { id: 'deepseek-v4-flash', provider: 'deepseek', label: 'DeepSeek V4 Flash', goodFor: 'Código, custo baixo' },
  { id: 'deepseek-v4-pro', provider: 'deepseek', label: 'DeepSeek V4 Pro', goodFor: 'Raciocínio profundo, tarefas complexas' },
  // NVIDIA NIM — família Nemotron 3.
  { id: 'nvidia/nemotron-3-super-120b-a12b', provider: 'nvidia', label: 'Nemotron 3 Super (NVIDIA)', goodFor: 'Raciocínio e uso de ferramentas' },
  { id: 'nvidia/nemotron-3-nano-30b-a3b', provider: 'nvidia', label: 'Nemotron 3 Nano (NVIDIA)', goodFor: 'Menor e mais rápido' },
];

/** Só devolve os modelos cujo provedor tem chave de API configurada no .env */
export function listAvailableModels(): ModelInfo[] {
  return MODEL_REGISTRY.filter((m) => hasProvider(m.provider));
}

export function findModel(id: string): ModelInfo | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}
