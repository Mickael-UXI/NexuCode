<<<<<<< HEAD
# Prompt — Correções e Novas Funcionalidades do Nexu

Use este documento como instrução completa para revisar e evoluir o projeto **Nexu** (chat de IA com modos Chat, Cowork e Nexu Design). Ele lista, em ordem de prioridade, tudo que está quebrado ou faltando hoje. Corrija cada item, teste o fluxo completo (não só o código isolado) e só considere "resolvido" quando o critério de aceite de cada seção for satisfeito.

---

## 1. Histórico de conversas não aparece na Sidebar

**Problema:** as conversas salvas não aparecem na lista lateral (`Sidebar.tsx`), mesmo existindo no banco.

**Onde olhar:** `src/lib/history.ts` (funções `listConversations`, `createConversation`, `touchConversation`), `src/components/Sidebar.tsx` (recebe `conversations` via prop) e o componente que carrega isso (`Chat.tsx`/`Cowork.tsx`).

**O que fazer:**
- Verificar se `listConversations()` está de fato sendo chamado ao montar o Chat/Cowork e se o resultado está sendo passado pra `Sidebar`.
- Confirmar que o RLS (Row Level Security) das tabelas `chat_conversations` e `chat_messages` no Supabase está permitindo `SELECT` para o usuário logado (`auth.uid()`), e não só `INSERT`.
- Garantir que toda vez que uma conversa nova é criada (`createConversation`) ou atualizada (`touchConversation`), a lista na Sidebar é recarregada/atualizada (state local, não só banco).
- Testar: criar conversa nova, recarregar a página, abrir Sidebar → a conversa tem que aparecer, com título correto.

**Critério de aceite:** toda conversa criada aparece na Sidebar imediatamente e continua aparecendo após reload da página e após logout/login.

---

## 2. IA não guarda memória entre conversas diferentes

**Problema:** a IA não lembra de informações de outras conversas do mesmo usuário (perfil, preferências, projetos anteriores).

**Onde olhar:** `server/lib/memory.ts`, `server/routes/memory.ts`, `src/lib/memory.ts`, migration `supabase/migrations/20260913160000_user_memory.sql`.

**O que fazer:**
- Confirmar que a memória é salva por `user_id` (não por `conversation_id`), numa tabela própria de memória do usuário.
- Confirmar que, ao montar o prompt do sistema em `server/lib/prompts.ts` / `server/routes/chat.ts`, a memória do usuário é **buscada e injetada** no contexto antes de chamar o provider de IA — em toda conversa nova, não só na mesma conversa.
- Implementar (se não existir) a extração automática de fatos relevantes ao final de cada resposta (ou periodicamente) e a gravação incremental na tabela de memória, evitando duplicar ou sobrescrever tudo a cada turno.
- Adicionar um limite de tamanho de memória (resumir/compactar quando passar de X tokens) pra não explodir o contexto.

**Critério de aceite:** o usuário conta algo relevante numa conversa (ex.: "meu projeto se chama X, uso React"), abre uma conversa nova e a IA já sabe essa informação sem precisar repetir.

---

## 3. Geração de projeto não junta todos os arquivos e não gera o .zip

**Problema:** quando a IA gera um projeto com vários arquivos, no final ela não consolida tudo nem gera o `.zip` corretamente.

**Onde olhar:** `src/lib/artifacts.ts`, `src/components/Cowork.tsx` (botão "Baixar .zip"), `server/routes/zip.ts`, `server/routes/files.ts`.

**O que fazer:**
- Garantir que o estado de "arquivos do projeto" no Cowork acumula **todos** os arquivos criados/editados ao longo da conversa (não só o último bloco de código gerado), com caminho (`path`) correto para cada um.
- Ao clicar em "Baixar .zip", enviar **todos** os arquivos atuais do projeto (`POST /files/zip`) e não um subconjunto.
- Validar que `AdmZip` no backend (`server/routes/zip.ts`) está recebendo a lista completa e que a resposta binária chega inteira no front (checar `Content-Type`/`Content-Disposition` e o `fetch` como `blob`, não como `json`).
- Adicionar tratamento de erro visível na UI se o zip falhar (hoje pode estar falhando silenciosamente).

**Critério de aceite:** gerar um projeto com pelo menos 5 arquivos em pastas diferentes, baixar o `.zip` e confirmar que **todos** os arquivos e pastas estão dentro, com o conteúdo final (não intermediário).


---

## 5. Split screen do Cowork/Nexu Design muito bugado

**Problema:** a divisão entre o chat e o painel de arquivos/código (split screen) está com bugs (redimensionamento, sincronização de estado, travamentos).

**Onde olhar:** `src/components/Cowork.tsx` (painel de arquivos, editor, abas).

**O que fazer:**
- Revisar o layout responsivo do split (flex/grid) — testar em telas pequenas e redimensionamento da janela; hoje provavelmente quebra em mobile/telas estreitas.
- Corrigir sincronização entre o arquivo sendo editado/exibido e a mensagem que a IA está gerando ao vivo (evitar “pular” de arquivo, perder scroll, ou sobrescrever edição manual do usuário enquanto a IA ainda está gerando).
- Adicionar um divisor arrastável (resizable handle) entre o chat e o painel de arquivos, com o tamanho lembrado (localStorage/estado) entre sessões.
- Corrigir qualquer race condition entre "arquivo sendo streamado pela IA" e "usuário editando manualmente" (`editText` em `Cowork.tsx`) — hoje pode estar conflitando.

**Critério de aceite:** abrir o Cowork, gerar um projeto com vários arquivos, trocar de aba entre eles, redimensionar o painel e editar manualmente um arquivo enquanto a IA termina de gerar outro — nada deve travar, sumir ou sobrescrever o que o usuário digitou.

---

## 6. Preview ao vivo dentro do split screen (rodar o site direto na IA)

**Problema:** hoje não existe nenhuma forma de rodar/visualizar o site sendo gerado; o usuário só vê código.

**O que fazer:**
- Adicionar uma terceira aba no painel do split screen: **Preview**, ao lado de "Código"/"Arquivos".
- Para projetos front-end (HTML/CSS/JS puro ou React/Vite), renderizar o resultado num `<iframe>` sandboxed dentro do próprio painel, atualizando ao vivo conforme os arquivos mudam (debounce para não recompilar a cada caractere).
- Usar (ou integrar com) o sandbox que já existe em `server/routes/sandbox.ts` — verificar se ele já sobe um ambiente de execução; se sim, apontar o preview pra URL/porta gerada por ele; se não, implementar um bundler leve no navegador (ex.: esbuild-wasm ou Sandpack) para HTML/CSS/JS e React simples.
- Tratar erros de build/runtime mostrando o erro dentro do próprio preview (como um `overlay` de erro), não só no console.
- Botão de "Abrir em nova aba" e "Recarregar preview" no topo do painel.

**Critério de aceite:** gerar uma landing page simples, clicar em "Preview" e ver o site renderizado de fato, atualizando conforme a IA edita os arquivos.

---

## 7. Adicionar terminal integrado

**Problema:** não existe terminal nenhum hoje.

**O que fazer:**
- Adicionar uma aba "Terminal" no mesmo painel do split screen (junto com Código/Preview).
- Conectar esse terminal ao sandbox de execução (`server/routes/sandbox.ts`) via WebSocket, permitindo rodar comandos reais (`npm install`, `npm run dev`, etc.) dentro do ambiente isolado do projeto.
- Exibir stdout/stderr em tempo real, com suporte a cores ANSI básico (ex.: usando `xterm.js` no front).
- Deixar claro na UI os limites de segurança (comandos bloqueados, timeout, sem acesso à rede externa se for o caso).

**Critério de aceite:** abrir o terminal, rodar `npm install` e `npm run dev` (ou equivalente) no projeto que a IA gerou, e ver a saída real no terminal, com o preview refletindo o resultado.

---

## 8. Separar os propósitos: Nexu Design x Cowork

**Problema:** hoje os dois usam exatamente o mesmo componente/comportamento (`Cowork.tsx` com `variant="design"`), sem diferença real de propósito.

**O que fazer:**
- **Nexu Design**: focar só em geração visual/UI — layouts, telas, protótipos, paletas, componentes visuais. O prompt de sistema (`server/lib/prompts.ts`) usado nesse modo deve instruir a IA a **não** se aprofundar em lógica de backend/arquitetura complexa, e priorizar entregar HTML/CSS/React visual, mockups e variações de design.
- **Cowork**: focar em tarefas de programação **longas e completas** — projetos inteiros, múltiplos arquivos, backend, integrações, testes. Ajustar o prompt de sistema correspondente para reforçar isso (arquitetura, boas práticas, testes, organização de pastas).
- Definir prompts de sistema diferentes por `variant` em `server/lib/prompts.ts` (hoje aparentemente é o mesmo prompt pros dois) e passar essa `variant` até a chamada da IA em `server/routes/chat.ts`.
- Ajustar as mensagens de boas-vindas e sugestões iniciais de cada modo para refletir esse foco (o texto de boas-vindas do Cowork já existe; criar um específico e diferente para o Design).

**Critério de aceite:** pedir a mesma coisa ambígua (ex.: "cria um app de tarefas") nos dois modos e ver respostas com foco claramente diferente — Design entrega telas/visual, Cowork entrega o projeto funcional completo.

---

## 9. Unificar o design da interface do chat (Nexu Design e Cowork iguais ao Chat simples)

**Problema:** a interface de chat do Cowork e do Nexu Design é visualmente diferente do Chat simples (`Chat.tsx`), e o usuário quer que as três sejam visualmente iguais na parte de chat (bolhas de mensagem, composer, header, etc.), mudando só o painel lateral de arquivos/preview/terminal que é exclusivo do Cowork/Design.

**O que fazer:**
- Extrair a área de mensagens + composer do `Chat.tsx` (lista de mensagens, `renderComposer`, markdown, feedback 👍/👎, anexos, menu de ferramentas) para um componente compartilhado (ex.: `ChatPane.tsx`) reutilizável.
- Fazer `Chat.tsx`, `Cowork.tsx` (e por consequência o Nexu Design) consumirem esse mesmo componente para a parte de conversa, mudando apenas o que aparece do lado do split screen (arquivos/preview/terminal) quando for Cowork/Design.
- Garantir que estilos (`index.css`, classes Tailwind) fiquem idênticos entre os três — mesma fonte, cores, espaçamento, bolhas de mensagem, avatar, etc.

**Critério de aceite:** colocar Chat, Cowork e Nexu Design lado a lado — a área de conversa deve ser visualmente indistinguível entre eles; só o painel lateral muda.


---

## 11. Novas funções de IA: geração de vídeo e geração de imagem (estilo "Nano Banana")

**O que fazer:**
- Adicionar no menu de ferramentas do composer (o mesmo menu do "+" já existente em `Chat.tsx`) duas novas opções: **Gerar imagem** e **Gerar vídeo**.
- No backend (`server/lib/providers.ts` / novo arquivo `server/routes/media.ts`), integrar com um provider de geração de imagem (ex.: Gemini "Nano Banana" / Imagen, ou outro provider configurável via `.env`) e um provider de geração de vídeo (ex.: Veo, Runway, ou outro configurável).
- Seguir o mesmo padrão de `modelRegistry.ts` para permitir múltiplos providers de imagem/vídeo, selecionáveis pelo usuário.
- Renderizar o resultado (imagem ou vídeo) direto na bolha de mensagem do chat (usando o `MarkdownMessage.tsx` ou um componente novo `MediaMessage.tsx`), com botão de download.
- Adicionar limites de uso/plano (reaproveitar `server/lib/messageLimits.ts` e `rateLimiter.ts`) para geração de mídia, já que costuma ser mais caro que texto.

**Critério de aceite:** pedir "gere uma imagem de X" e "gere um vídeo de Y" no chat e receber o resultado renderizado, com opção de download, respeitando os limites do plano do usuário.

---

## 12. Conectores (Vercel, GitHub e outros)

**Onde olhar:** `server/routes/github.ts` (já existe integração básica com GitHub).

**O que fazer:**
- Revisar/completar a integração já existente com GitHub em `server/routes/github.ts`: autenticação OAuth, criação de repositório, push do projeto gerado no Cowork direto para um repo (hoje o botão "Baixar .zip" existe, adicionar ao lado "Enviar para o GitHub").
- Adicionar um novo conector com **Vercel** (via API de deploy da Vercel): permitir que, a partir de um projeto gerado no Cowork, o usuário clique em "Publicar na Vercel" e receba a URL de deploy.
- Estruturar os conectores de forma extensível (ex.: `server/lib/connectors/` com um arquivo por serviço: `github.ts`, `vercel.ts`, `netlify.ts`, `supabase.ts`, etc.), já que o `netlify.toml` sugere que Netlify também é um destino de deploy pretendido.
- Adicionar uma tela/painel de "Conectores" nas configurações da conta (`AccountSettings.tsx`) onde o usuário conecta/desconecta cada serviço (guardando tokens de forma segura, nunca no front).
- Sugerir também conectores adicionais úteis: Netlify (deploy), Supabase (banco de dados do próprio projeto gerado), Slack (notificações), Figma (importar design).

**Critério de aceite:** conectar a conta do GitHub e da Vercel nas configurações, gerar um projeto no Cowork, enviar pro GitHub e publicar na Vercel, tudo sem sair do Nexu.

---
Produto / UX

Busca dentro do histórico de conversas (a lista cresce rápido com 6 mil usuários em potencial)
Compartilhar uma conversa/projeto via link público (read-only)
Atalhos de teclado (Cmd+K pra nova conversa, navegação entre modos)
Modo offline/rascunho: continuar digitando mesmo se a API cair, sem perder o texto

IA / Cowork

Diff visual antes de aplicar uma edição de arquivo (em vez de já sobrescrever direto)
"Modo plano": a IA descreve o que vai fazer antes de gerar código, usuário aprova
Histórico de versões navegável por arquivo (não só o Artefato geral)
Importar um repositório GitHub existente direto pra dentro do Cowork (hoje só exporta)

Conta / negócio

Onboarding com checklist pro usuário novo (já que a plataforma tem vários modos)
Página de uso/consumo (quantas mensagens, tokens, custo por dia) pro usuário acompanhar o próprio plano
Convite de equipe (múltiplos usuários vendo o mesmo projeto) — hoje parece 100% single-user

Infra / confiabilidade

Fila/retry automático se o provider de IA cair no meio de uma resposta longa
Backup/export de todas as conversas em um clique (JSON ou markdown)

### Como usar este documento
=======
# Prompt — Correções e Novas Funcionalidades do Nexu

Use este documento como instrução completa para revisar e evoluir o projeto **Nexu** (chat de IA com modos Chat, Cowork e Nexu Design). Ele lista, em ordem de prioridade, tudo que está quebrado ou faltando hoje. Corrija cada item, teste o fluxo completo (não só o código isolado) e só considere "resolvido" quando o critério de aceite de cada seção for satisfeito.

---

## 1. Histórico de conversas não aparece na Sidebar

**Problema:** as conversas salvas não aparecem na lista lateral (`Sidebar.tsx`), mesmo existindo no banco.

**Onde olhar:** `src/lib/history.ts` (funções `listConversations`, `createConversation`, `touchConversation`), `src/components/Sidebar.tsx` (recebe `conversations` via prop) e o componente que carrega isso (`Chat.tsx`/`Cowork.tsx`).

**O que fazer:**
- Verificar se `listConversations()` está de fato sendo chamado ao montar o Chat/Cowork e se o resultado está sendo passado pra `Sidebar`.
- Confirmar que o RLS (Row Level Security) das tabelas `chat_conversations` e `chat_messages` no Supabase está permitindo `SELECT` para o usuário logado (`auth.uid()`), e não só `INSERT`.
- Garantir que toda vez que uma conversa nova é criada (`createConversation`) ou atualizada (`touchConversation`), a lista na Sidebar é recarregada/atualizada (state local, não só banco).
- Testar: criar conversa nova, recarregar a página, abrir Sidebar → a conversa tem que aparecer, com título correto.

**Critério de aceite:** toda conversa criada aparece na Sidebar imediatamente e continua aparecendo após reload da página e após logout/login.

---

## 2. IA não guarda memória entre conversas diferentes

**Problema:** a IA não lembra de informações de outras conversas do mesmo usuário (perfil, preferências, projetos anteriores).

**Onde olhar:** `server/lib/memory.ts`, `server/routes/memory.ts`, `src/lib/memory.ts`, migration `supabase/migrations/20260913160000_user_memory.sql`.

**O que fazer:**
- Confirmar que a memória é salva por `user_id` (não por `conversation_id`), numa tabela própria de memória do usuário.
- Confirmar que, ao montar o prompt do sistema em `server/lib/prompts.ts` / `server/routes/chat.ts`, a memória do usuário é **buscada e injetada** no contexto antes de chamar o provider de IA — em toda conversa nova, não só na mesma conversa.
- Implementar (se não existir) a extração automática de fatos relevantes ao final de cada resposta (ou periodicamente) e a gravação incremental na tabela de memória, evitando duplicar ou sobrescrever tudo a cada turno.
- Adicionar um limite de tamanho de memória (resumir/compactar quando passar de X tokens) pra não explodir o contexto.

**Critério de aceite:** o usuário conta algo relevante numa conversa (ex.: "meu projeto se chama X, uso React"), abre uma conversa nova e a IA já sabe essa informação sem precisar repetir.

---

## 3. Geração de projeto não junta todos os arquivos e não gera o .zip

**Problema:** quando a IA gera um projeto com vários arquivos, no final ela não consolida tudo nem gera o `.zip` corretamente.

**Onde olhar:** `src/lib/artifacts.ts`, `src/components/Cowork.tsx` (botão "Baixar .zip"), `server/routes/zip.ts`, `server/routes/files.ts`.

**O que fazer:**
- Garantir que o estado de "arquivos do projeto" no Cowork acumula **todos** os arquivos criados/editados ao longo da conversa (não só o último bloco de código gerado), com caminho (`path`) correto para cada um.
- Ao clicar em "Baixar .zip", enviar **todos** os arquivos atuais do projeto (`POST /files/zip`) e não um subconjunto.
- Validar que `AdmZip` no backend (`server/routes/zip.ts`) está recebendo a lista completa e que a resposta binária chega inteira no front (checar `Content-Type`/`Content-Disposition` e o `fetch` como `blob`, não como `json`).
- Adicionar tratamento de erro visível na UI se o zip falhar (hoje pode estar falhando silenciosamente).

**Critério de aceite:** gerar um projeto com pelo menos 5 arquivos em pastas diferentes, baixar o `.zip` e confirmar que **todos** os arquivos e pastas estão dentro, com o conteúdo final (não intermediário).


---

## 5. Split screen do Cowork/Nexu Design muito bugado

**Problema:** a divisão entre o chat e o painel de arquivos/código (split screen) está com bugs (redimensionamento, sincronização de estado, travamentos).

**Onde olhar:** `src/components/Cowork.tsx` (painel de arquivos, editor, abas).

**O que fazer:**
- Revisar o layout responsivo do split (flex/grid) — testar em telas pequenas e redimensionamento da janela; hoje provavelmente quebra em mobile/telas estreitas.
- Corrigir sincronização entre o arquivo sendo editado/exibido e a mensagem que a IA está gerando ao vivo (evitar “pular” de arquivo, perder scroll, ou sobrescrever edição manual do usuário enquanto a IA ainda está gerando).
- Adicionar um divisor arrastável (resizable handle) entre o chat e o painel de arquivos, com o tamanho lembrado (localStorage/estado) entre sessões.
- Corrigir qualquer race condition entre "arquivo sendo streamado pela IA" e "usuário editando manualmente" (`editText` em `Cowork.tsx`) — hoje pode estar conflitando.

**Critério de aceite:** abrir o Cowork, gerar um projeto com vários arquivos, trocar de aba entre eles, redimensionar o painel e editar manualmente um arquivo enquanto a IA termina de gerar outro — nada deve travar, sumir ou sobrescrever o que o usuário digitou.

---

## 6. Preview ao vivo dentro do split screen (rodar o site direto na IA)

**Problema:** hoje não existe nenhuma forma de rodar/visualizar o site sendo gerado; o usuário só vê código.

**O que fazer:**
- Adicionar uma terceira aba no painel do split screen: **Preview**, ao lado de "Código"/"Arquivos".
- Para projetos front-end (HTML/CSS/JS puro ou React/Vite), renderizar o resultado num `<iframe>` sandboxed dentro do próprio painel, atualizando ao vivo conforme os arquivos mudam (debounce para não recompilar a cada caractere).
- Usar (ou integrar com) o sandbox que já existe em `server/routes/sandbox.ts` — verificar se ele já sobe um ambiente de execução; se sim, apontar o preview pra URL/porta gerada por ele; se não, implementar um bundler leve no navegador (ex.: esbuild-wasm ou Sandpack) para HTML/CSS/JS e React simples.
- Tratar erros de build/runtime mostrando o erro dentro do próprio preview (como um `overlay` de erro), não só no console.
- Botão de "Abrir em nova aba" e "Recarregar preview" no topo do painel.

**Critério de aceite:** gerar uma landing page simples, clicar em "Preview" e ver o site renderizado de fato, atualizando conforme a IA edita os arquivos.

---

## 7. Adicionar terminal integrado

**Problema:** não existe terminal nenhum hoje.

**O que fazer:**
- Adicionar uma aba "Terminal" no mesmo painel do split screen (junto com Código/Preview).
- Conectar esse terminal ao sandbox de execução (`server/routes/sandbox.ts`) via WebSocket, permitindo rodar comandos reais (`npm install`, `npm run dev`, etc.) dentro do ambiente isolado do projeto.
- Exibir stdout/stderr em tempo real, com suporte a cores ANSI básico (ex.: usando `xterm.js` no front).
- Deixar claro na UI os limites de segurança (comandos bloqueados, timeout, sem acesso à rede externa se for o caso).

**Critério de aceite:** abrir o terminal, rodar `npm install` e `npm run dev` (ou equivalente) no projeto que a IA gerou, e ver a saída real no terminal, com o preview refletindo o resultado.

---

## 8. Separar os propósitos: Nexu Design x Cowork

**Problema:** hoje os dois usam exatamente o mesmo componente/comportamento (`Cowork.tsx` com `variant="design"`), sem diferença real de propósito.

**O que fazer:**
- **Nexu Design**: focar só em geração visual/UI — layouts, telas, protótipos, paletas, componentes visuais. O prompt de sistema (`server/lib/prompts.ts`) usado nesse modo deve instruir a IA a **não** se aprofundar em lógica de backend/arquitetura complexa, e priorizar entregar HTML/CSS/React visual, mockups e variações de design.
- **Cowork**: focar em tarefas de programação **longas e completas** — projetos inteiros, múltiplos arquivos, backend, integrações, testes. Ajustar o prompt de sistema correspondente para reforçar isso (arquitetura, boas práticas, testes, organização de pastas).
- Definir prompts de sistema diferentes por `variant` em `server/lib/prompts.ts` (hoje aparentemente é o mesmo prompt pros dois) e passar essa `variant` até a chamada da IA em `server/routes/chat.ts`.
- Ajustar as mensagens de boas-vindas e sugestões iniciais de cada modo para refletir esse foco (o texto de boas-vindas do Cowork já existe; criar um específico e diferente para o Design).

**Critério de aceite:** pedir a mesma coisa ambígua (ex.: "cria um app de tarefas") nos dois modos e ver respostas com foco claramente diferente — Design entrega telas/visual, Cowork entrega o projeto funcional completo.

---

## 9. Unificar o design da interface do chat (Nexu Design e Cowork iguais ao Chat simples)

**Problema:** a interface de chat do Cowork e do Nexu Design é visualmente diferente do Chat simples (`Chat.tsx`), e o usuário quer que as três sejam visualmente iguais na parte de chat (bolhas de mensagem, composer, header, etc.), mudando só o painel lateral de arquivos/preview/terminal que é exclusivo do Cowork/Design.

**O que fazer:**
- Extrair a área de mensagens + composer do `Chat.tsx` (lista de mensagens, `renderComposer`, markdown, feedback 👍/👎, anexos, menu de ferramentas) para um componente compartilhado (ex.: `ChatPane.tsx`) reutilizável.
- Fazer `Chat.tsx`, `Cowork.tsx` (e por consequência o Nexu Design) consumirem esse mesmo componente para a parte de conversa, mudando apenas o que aparece do lado do split screen (arquivos/preview/terminal) quando for Cowork/Design.
- Garantir que estilos (`index.css`, classes Tailwind) fiquem idênticos entre os três — mesma fonte, cores, espaçamento, bolhas de mensagem, avatar, etc.

**Critério de aceite:** colocar Chat, Cowork e Nexu Design lado a lado — a área de conversa deve ser visualmente indistinguível entre eles; só o painel lateral muda.


---

## 11. Novas funções de IA: geração de vídeo e geração de imagem (estilo "Nano Banana")

**O que fazer:**
- Adicionar no menu de ferramentas do composer (o mesmo menu do "+" já existente em `Chat.tsx`) duas novas opções: **Gerar imagem** e **Gerar vídeo**.
- No backend (`server/lib/providers.ts` / novo arquivo `server/routes/media.ts`), integrar com um provider de geração de imagem (ex.: Gemini "Nano Banana" / Imagen, ou outro provider configurável via `.env`) e um provider de geração de vídeo (ex.: Veo, Runway, ou outro configurável).
- Seguir o mesmo padrão de `modelRegistry.ts` para permitir múltiplos providers de imagem/vídeo, selecionáveis pelo usuário.
- Renderizar o resultado (imagem ou vídeo) direto na bolha de mensagem do chat (usando o `MarkdownMessage.tsx` ou um componente novo `MediaMessage.tsx`), com botão de download.
- Adicionar limites de uso/plano (reaproveitar `server/lib/messageLimits.ts` e `rateLimiter.ts`) para geração de mídia, já que costuma ser mais caro que texto.

**Critério de aceite:** pedir "gere uma imagem de X" e "gere um vídeo de Y" no chat e receber o resultado renderizado, com opção de download, respeitando os limites do plano do usuário.

---

## 12. Conectores (Vercel, GitHub e outros)

**Onde olhar:** `server/routes/github.ts` (já existe integração básica com GitHub).

**O que fazer:**
- Revisar/completar a integração já existente com GitHub em `server/routes/github.ts`: autenticação OAuth, criação de repositório, push do projeto gerado no Cowork direto para um repo (hoje o botão "Baixar .zip" existe, adicionar ao lado "Enviar para o GitHub").
- Adicionar um novo conector com **Vercel** (via API de deploy da Vercel): permitir que, a partir de um projeto gerado no Cowork, o usuário clique em "Publicar na Vercel" e receba a URL de deploy.
- Estruturar os conectores de forma extensível (ex.: `server/lib/connectors/` com um arquivo por serviço: `github.ts`, `vercel.ts`, `netlify.ts`, `supabase.ts`, etc.), já que o `netlify.toml` sugere que Netlify também é um destino de deploy pretendido.
- Adicionar uma tela/painel de "Conectores" nas configurações da conta (`AccountSettings.tsx`) onde o usuário conecta/desconecta cada serviço (guardando tokens de forma segura, nunca no front).
- Sugerir também conectores adicionais úteis: Netlify (deploy), Supabase (banco de dados do próprio projeto gerado), Slack (notificações), Figma (importar design).

**Critério de aceite:** conectar a conta do GitHub e da Vercel nas configurações, gerar um projeto no Cowork, enviar pro GitHub e publicar na Vercel, tudo sem sair do Nexu.

---
Produto / UX

Busca dentro do histórico de conversas (a lista cresce rápido com 6 mil usuários em potencial)
Compartilhar uma conversa/projeto via link público (read-only)
Atalhos de teclado (Cmd+K pra nova conversa, navegação entre modos)
Modo offline/rascunho: continuar digitando mesmo se a API cair, sem perder o texto

IA / Cowork

Diff visual antes de aplicar uma edição de arquivo (em vez de já sobrescrever direto)
"Modo plano": a IA descreve o que vai fazer antes de gerar código, usuário aprova
Histórico de versões navegável por arquivo (não só o Artefato geral)
Importar um repositório GitHub existente direto pra dentro do Cowork (hoje só exporta)

Conta / negócio

Onboarding com checklist pro usuário novo (já que a plataforma tem vários modos)
Página de uso/consumo (quantas mensagens, tokens, custo por dia) pro usuário acompanhar o próprio plano
Convite de equipe (múltiplos usuários vendo o mesmo projeto) — hoje parece 100% single-user

Infra / confiabilidade

Fila/retry automático se o provider de IA cair no meio de uma resposta longa
Backup/export de todas as conversas em um clique (JSON ou markdown)

### Como usar este documento
>>>>>>> 6da7f6cecf24ab99637de281e04640c510f77319
Trate cada seção numerada como uma tarefa independente, mas siga a ordem: os itens 1–4 são bugs bloqueantes (dados não aparecem/não salvam), 5–10 são de UX/produto, e 11–13 são novas funcionalidades. Ao final de cada seção, valide o "Critério de aceite" antes de passar para a próxima.