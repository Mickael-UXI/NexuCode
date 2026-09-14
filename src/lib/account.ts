import { supabase } from '@/lib/supabase';

export interface MyProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  segment: string | null;
}

/** Áreas de uso oferecidas no seletor de "Personalizar a experiência" (item 7). */
export const ACCOUNT_SEGMENTS = [
  { value: 'development', label: 'Desenvolvimento' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'design', label: 'Design' },
  { value: 'studies', label: 'Estudos' },
  { value: 'business', label: 'Negócios / Gestão' },
  { value: 'other', label: 'Outro' },
] as const;

export async function getMyProfile(userId: string): Promise<MyProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, segment')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('Falha ao carregar perfil:', error.message);
    return null;
  }
  return data;
}

export async function updateMyProfile(
  userId: string,
  input: { full_name?: string; segment?: string | null }
): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) {
    console.error('Falha ao atualizar perfil:', error.message);
    return false;
  }
  return true;
}

/** Troca a senha da conta logada. O Supabase já exige que a sessão atual seja válida —
 *  não pede a senha antiga porque a própria sessão ativa já prova a posse da conta. */
export async function updateMyPassword(newPassword: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error?.message ?? null;
}

export async function updateMyEmail(newEmail: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  return error?.message ?? null;
}

/** Sobe um novo avatar pro bucket público `avatars` (uma pasta por usuário, pra bater
 *  com a policy de storage que só deixa cada um escrever na própria pasta) e já
 *  atualiza `profiles.avatar_url` com a URL pública resultante. */
export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (uploadError) {
    console.error('Falha ao enviar avatar:', uploadError.message);
    return null;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const publicUrl = data.publicUrl;
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (profileError) {
    console.error('Falha ao salvar URL do avatar no perfil:', profileError.message);
    return null;
  }
  return publicUrl;
}
