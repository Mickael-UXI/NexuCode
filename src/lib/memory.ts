export interface MemoryNote {
  id: string;
  content: string;
  created_at: string;
}

/** Lista os fatos que a IA guardou sobre o usuário logado (precisa do token de sessão). */
export async function listMemory(accessToken: string): Promise<MemoryNote[]> {
  const res = await fetch('/api/memory', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.notes ?? [];
}

/** Apaga um fato específico — "esquecer" algo pontual sem apagar o resto da memória. */
export async function deleteMemoryNote(accessToken: string, id: string): Promise<boolean> {
  const res = await fetch(`/api/memory/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok;
}
