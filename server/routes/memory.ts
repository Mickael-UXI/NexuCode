import { Router } from 'express';
import { getUserFromRequest } from '../lib/auth.js';
import { listMemoryNotes, deleteMemoryNote, addMemoryNote } from '../lib/memory.js';

export const memoryRouter = Router();

/** Lista os fatos guardados sobre o usuário logado (tela "Personalizar" > Memória). */
memoryRouter.get('/memory', async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Não autenticado.' });
  const notes = await listMemoryNotes(user.id);
  res.json({ notes });
});

/** Permite o usuário adicionar manualmente um fato ("lembre que eu..."). */
memoryRouter.post('/memory', async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Não autenticado.' });
  const { content } = req.body as { content?: string };
  if (!content || !content.trim()) return res.status(400).json({ error: 'Conteúdo vazio.' });
  await addMemoryNote(user.id, content);
  res.json({ ok: true });
});

/** Apaga um fato específico — usuário pode "esquecer" algo a qualquer momento. */
memoryRouter.delete('/memory/:id', async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Não autenticado.' });
  const ok = await deleteMemoryNote(user.id, req.params.id);
  if (!ok) return res.status(500).json({ error: 'Falha ao apagar.' });
  res.json({ ok: true });
});
