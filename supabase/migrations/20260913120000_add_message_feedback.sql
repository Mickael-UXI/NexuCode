/*
# Feedback por mensagem (👍/👎)

1. Changes
- Adiciona a coluna `feedback` em `chat_messages`, aceitando apenas
  'up', 'down' ou NULL (sem feedback / feedback removido).

2. Security
- Nenhuma policy nova é necessária: a policy de UPDATE já existente
  em `chat_messages` (`chat_messages_update_own`) cobre qualquer
  coluna, incluindo esta, restrita ao dono da conversa.
*/

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS feedback text NULL CHECK (feedback IN ('up', 'down'));
