/*
# Projetos, Artefatos e campos de conta

1. New Tables
- `projects` — agrupa conversas sob um nome, descrição opcional e instruções
  persistentes (aplicadas pelo cliente como parte do system prompt em toda
  conversa daquele projeto).
- `artifacts` — um registro por "artefato" que a IA gera (bloco de código,
  documento, etc.), vinculado à conversa de origem. Guarda o conteúdo mais
  recente e o número da versão atual.
- `artifact_versions` — histórico completo de versões de cada artefato
  (uma linha por edição/regeneração).

2. Changes to existing tables
- `chat_conversations.project_id` — referência opcional ao projeto ao qual a
  conversa pertence (NULL = conversa avulsa, fora de qualquer projeto).
- `profiles.full_name`, `profiles.avatar_url`, `profiles.segment` — campos de
  conta editáveis pelo próprio usuário (nome, foto de perfil e área de uso,
  ex.: desenvolvimento/marketing/estudos/design).

3. Storage
- Bucket público `avatars` para fotos de perfil, com policy restringindo
  upload/edição/remoção ao próprio usuário (primeiro segmento do caminho do
  arquivo precisa ser o `auth.uid()`), mas leitura pública (necessária pra
  exibir o avatar sem re-autenticar em cada request).

4. Security
- RLS habilitada em todas as tabelas novas, mesmo padrão "só o dono acessa"
  já usado em `chat_conversations`/`chat_messages`.
*/

-- 1. Projetos ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_user_updated_idx ON public.projects (user_id, updated_at DESC);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
CREATE POLICY "projects_select_own" ON public.projects FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
CREATE POLICY "projects_insert_own" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
CREATE POLICY "projects_update_own" ON public.projects FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
CREATE POLICY "projects_delete_own" ON public.projects FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Conversa pode pertencer a um projeto (opcional).
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chat_conversations_project_idx
  ON public.chat_conversations (project_id);

-- 2. Artefatos ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'chat' CHECK (mode IN ('chat', 'cowork')),
  title text NOT NULL,
  language text,
  content text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS artifacts_user_updated_idx ON public.artifacts (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS artifacts_conversation_idx ON public.artifacts (conversation_id);
-- Um artefato por (conversa, título) — reenviar o mesmo arquivo/trecho vira nova versão
-- do mesmo registro em vez de duplicar.
CREATE UNIQUE INDEX IF NOT EXISTS artifacts_conversation_title_uidx
  ON public.artifacts (conversation_id, title);

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artifacts_select_own" ON public.artifacts;
CREATE POLICY "artifacts_select_own" ON public.artifacts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "artifacts_insert_own" ON public.artifacts;
CREATE POLICY "artifacts_insert_own" ON public.artifacts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "artifacts_update_own" ON public.artifacts;
CREATE POLICY "artifacts_update_own" ON public.artifacts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "artifacts_delete_own" ON public.artifacts;
CREATE POLICY "artifacts_delete_own" ON public.artifacts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.artifact_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id uuid NOT NULL REFERENCES public.artifacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS artifact_versions_artifact_idx
  ON public.artifact_versions (artifact_id, version DESC);

ALTER TABLE public.artifact_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artifact_versions_select_own" ON public.artifact_versions;
CREATE POLICY "artifact_versions_select_own" ON public.artifact_versions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "artifact_versions_insert_own" ON public.artifact_versions;
CREATE POLICY "artifact_versions_insert_own" ON public.artifact_versions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Conta ----------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS segment text;

-- 4. Storage para avatares --------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_owner_write" ON storage.objects;
CREATE POLICY "avatars_owner_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
