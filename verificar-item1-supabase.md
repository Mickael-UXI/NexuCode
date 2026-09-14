# Item 1 — Histórico não aparece: checklist pra rodar no Supabase

Revisei `src/lib/history.ts`, `src/components/Sidebar.tsx`, `src/components/Chat.tsx` e a
migration `20260912220426_create_authenticated_chat_storage.sql` — o código em si está
correto: `listConversations()` é chamado no mount e depois de criar/atualizar uma conversa,
e a policy de `SELECT` em `chat_conversations`/`chat_messages` existe e usa `auth.uid()`
corretamente. Não encontrei um bug de código pra esse item.

Isso aponta pra algo do lado do projeto Supabase em si. Rode isto no **SQL Editor** do
Supabase (Dashboard → seu projeto → SQL Editor) pra confirmar:

```sql
-- 1. A migration foi realmente aplicada? (tem que aparecer chat_conversations e chat_messages)
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('chat_conversations', 'chat_messages');

-- 2. RLS está de fato habilitado nas duas tabelas?
select relname, relrowsecurity from pg_class
where relname in ('chat_conversations', 'chat_messages');

-- 3. As policies existem mesmo (não só no arquivo .sql local)?
select tablename, policyname, cmd from pg_policies
where tablename in ('chat_conversations', 'chat_messages');

-- 4. Existem linhas na tabela pro seu usuário? (troque o e-mail)
select c.id, c.title, c.user_id, c.updated_at
from chat_conversations c
join auth.users u on u.id = c.user_id
where u.email = 'SEU_EMAIL_AQUI'
order by c.updated_at desc;
```

Se a query 4 mostrar linhas mas a Sidebar continuar vazia, o problema é confirmadamente
no front (nesse caso, abra o DevTools → Network, veja a resposta da chamada
`chat_conversations` e cole aqui o que vier). Se a query 1 ou 2 vier vazia, a migration
`20260912220426_create_authenticated_chat_storage.sql` nunca rodou nesse projeto Supabase
— rode-a manualmente colando o SQL dela no SQL Editor.

Também vale conferir o `.env` do projeto: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
têm que ser exatamente os do MESMO projeto Supabase onde essas migrations foram aplicadas
(um erro comum é ter dois projetos Supabase — um de teste e um "real" — e o `.env` apontar
pro errado).
