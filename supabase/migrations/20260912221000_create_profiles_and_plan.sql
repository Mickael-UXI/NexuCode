/*
# Create profiles table

1. New Tables
- `profiles` — um registro por usuário autenticado, com plano de assinatura
  e campo de papel (`role`) para diferenciar admins de usuários comuns.

2. Security
- Row Level Security habilitada.
- Cada usuário só pode ler/atualizar o próprio perfil.
- A escrita do campo `plan` normalmente é feita pelo servidor (service role,
  via webhook do Stripe), não diretamente pelo cliente.

3. Notes
- O login de administrador deste projeto é separado (usa ADMIN_EMAIL/
  ADMIN_PASSWORD_HASH no .env do servidor) e não depende desta tabela — o
  campo `role` aqui é só um espaço reservado caso você queira, no futuro,
  também marcar usuários comuns como admin dentro do Supabase.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Cria automaticamente um perfil quando um novo usuário se cadastra.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
