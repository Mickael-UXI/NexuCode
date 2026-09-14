/*
# Admin: banimento de usuários e log de chamadas de IA

1. Changes to `profiles`
- Adiciona `banned` (boolean) e `banned_at` (timestamptz) para permitir que o
  painel administrativo desative o acesso de um usuário sem excluir a conta.

2. New Tables
- `ai_call_logs` — um registro por chamada feita a um provedor de IA (sucesso
  ou erro), usado pelo painel admin para montar o gráfico de uso por provedor
  e o log de erros.

3. Security
- RLS habilitada em `ai_call_logs` sem nenhuma policy para usuários comuns:
  só a service role (usada pelo servidor) consegue ler/escrever. Nada é
  exposto ao cliente autenticado ou anônimo.
- `profiles.banned` já está coberto pelas policies existentes (usuário só lê
  o próprio perfil); a escrita desse campo é feita pelo servidor com a
  service role a partir do painel admin.

4. Important Notes
- `ai_call_logs.user_id` é anulável porque nem toda chamada tem um usuário
  autenticado identificável (ex.: variáveis de ambiente sem Supabase
  configurado). Quando o usuário é excluído, o log permanece com user_id nulo.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz;

CREATE TABLE IF NOT EXISTS public.ai_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text NOT NULL,
  mode text NOT NULL DEFAULT 'chat' CHECK (mode IN ('chat', 'cowork')),
  status text NOT NULL CHECK (status IN ('success', 'error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_call_logs_created_idx
  ON public.ai_call_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_call_logs_provider_idx
  ON public.ai_call_logs (provider);

CREATE INDEX IF NOT EXISTS ai_call_logs_status_idx
  ON public.ai_call_logs (status);

ALTER TABLE public.ai_call_logs ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy criada de propósito: acesso restrito à service role (servidor/admin).
