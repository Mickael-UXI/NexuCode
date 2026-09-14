import { Router } from 'express';
import { streamChat } from '../lib/providers.js';
import { findModel, listAvailableModels } from '../lib/modelRegistry.js';
import { CHAT_SYSTEM_PROMPT, COWORK_SYSTEM_PROMPT, DESIGN_SYSTEM_PROMPT } from '../lib/prompts.js';
import { getUserFromRequest, getProfile } from '../lib/auth.js';
import { logAiCall } from '../lib/aiCallLogger.js';
import { checkFreeMessageLimit } from '../lib/messageLimits.js';
import { aiRateLimiter } from '../lib/rateLimiter.js';
import { getMemoryContext, extractMemoryInBackground } from '../lib/memory.js';

export const chatRouter = Router();

chatRouter.get('/models', (_req, res) => {
  res.json({ models: listAvailableModels() });
});

// Rate limit por IP — protege a conta nos provedores de IA caso o site fique público.
chatRouter.use('/chat', aiRateLimiter);

const CONTINUE_INSTRUCTION =
  '\n\nIMPORTANTE: o usuário pediu para você continuar EXATAMENTE de onde a resposta anterior parou. ' +
  'Não repita nada do que já foi escrito, não se apresente de novo e não reinicie a explicação — apenas ' +
  'continue o texto/código a partir do ponto exato em que foi cortado.';

chatRouter.post('/chat', async (req, res) => {
  const { messages, modelId, mode, continuation, projectInstructions, conversationId } = req.body as {
    messages: { role: 'user' | 'assistant'; content: string }[];
    modelId: string;
    mode?: 'chat' | 'cowork' | 'design';
    continuation?: boolean;
    projectInstructions?: string;
    conversationId?: string;
  };

  const model = findModel(modelId);
  if (!model) {
    return res.status(400).json({ error: 'Modelo inválido ou indisponível. Verifique as chaves de API no .env.' });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Envie ao menos uma mensagem.' });
  }

  // Identifica o usuário (quando o Supabase está configurado e o front envia o
  // token de sessão) e bloqueia quem foi banido no painel admin, antes de abrir o stream.
  const user = await getUserFromRequest(req);
  if (user) {
    const profile = await getProfile(user.id);
    if (profile?.banned) {
      return res.status(403).json({ error: 'Sua conta foi desativada. Entre em contato com o suporte.' });
    }

    // Limite diário de mensagens do plano free — admins e assinantes "pro" não têm limite.
    if (profile && profile.plan === 'free' && profile.role !== 'admin') {
      const limitStatus = await checkFreeMessageLimit(user.id);
      if (!limitStatus.allowed) {
        return res.status(429).json({
          error: `Você atingiu o limite de ${limitStatus.limit} mensagens hoje no plano gratuito. Assine o plano Pro para continuar sem limites.`,
          limitReached: true,
        });
      }
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const baseSystem = mode === 'cowork' ? COWORK_SYSTEM_PROMPT : mode === 'design' ? DESIGN_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT;
  const withProject =
    projectInstructions && projectInstructions.trim()
      ? `${baseSystem}\n\nINSTRUÇÕES DO PROJETO (definidas pelo usuário, aplicam-se a todas as conversas dele — siga-as sempre que não conflitarem com instruções de segurança):\n${projectInstructions.trim()}`
      : baseSystem;
  // Memória (item 9 do backlog): fatos guardados de conversas anteriores, somados ao
  // final do system prompt pra não atrapalhar o cache de prompt do bloco principal.
  const memoryContext = await getMemoryContext(user?.id);
  const withMemory = withProject + memoryContext;
  const system = continuation ? withMemory + CONTINUE_INSTRUCTION : withMemory;

  try {
    let assistantBuffer = '';
    const finishReason = await streamChat({
      provider: model.provider,
      model: model.id,
      system,
      messages,
      onToken: (text) => {
        assistantBuffer += text;
        res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
      },
    });
    res.write(`data: ${JSON.stringify({ done: true, finishReason })}\n\n`);
    logAiCall({ userId: user?.id, provider: model.provider, model: model.id, mode: mode ?? 'chat', status: 'success' });

    // Fire-and-forget: não atrasa a resposta nem o fechamento do stream.
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    if (!continuation && lastUserMessage && assistantBuffer) {
      extractMemoryInBackground({
        userId: user?.id,
        conversationId,
        userMessage: lastUserMessage,
        assistantMessage: assistantBuffer,
      });
    }
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err?.message || 'Erro ao chamar o provedor de IA.' })}\n\n`);
    logAiCall({
      userId: user?.id,
      provider: model.provider,
      model: model.id,
      mode: mode ?? 'chat',
      status: 'error',
      errorMessage: err?.message,
    });
  } finally {
    res.end();
  }
});
