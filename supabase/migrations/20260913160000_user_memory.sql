/*
# Memória entre conversas (item 9 do backlog)

1. New Tables
- `user_memory` — fatos/preferências curtos que a IA aprendeu sobre o usuário
  ao longo de conversas passadas (ex.: "prefere respostas em TypeScript",
  "trabalha com Next.js"). Cada linha é um fato individual, com a conversa de
  origem (opcional, só para referência) e se foi o próprio usuário quem
  declarou o fato ou se a IA que inferiu/extraiu.

2. Security
- RLS habilitada, mesmo padrão "só o dono acessa" das demais tabelas.
*/

CREATE TABLE IF NOT EXISTS public.user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  source_conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_memory_user_created_idx ON public.user_memory (user_id, created_at DESC);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_memory_select_own" ON public.user_memory;
CREATE POLICY "user_memory_select_own" ON public.user_memory FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_memory_insert_own" ON public.user_memory;
CREATE POLICY "user_memory_insert_own" ON public.user_memory FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_memory_delete_own" ON public.user_memory;
CREATE POLICY "user_memory_delete_own" ON public.user_memory FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Modo "Nexu Design" (item 15) usa o mesmo pipeline de chamadas de IA do Cowork —
-- só precisa que o log de chamadas aceite esse terceiro valor de `mode`.
ALTER TABLE public.ai_call_logs DROP CONSTRAINT IF EXISTS ai_call_logs_mode_check;
ALTER TABLE public.ai_call_logs ADD CONSTRAINT ai_call_logs_mode_check CHECK (mode IN ('chat', 'cowork', 'design'));
