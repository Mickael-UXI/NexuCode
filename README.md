# Nexucode

Site + Nexus Chat + Nexus Cowork (agente de IA focado em programação), com
login, planos via Stripe e painel administrativo.

## O que mudou nesta versão

- **Design**: intocado. Só a lógica/estrutura por trás mudou.
- **Chat e Cowork agora falam com IA de verdade** (Anthropic, OpenAI, Gemini,
  Groq ou DeepSeek — você escolhe quais chaves configurar). Antes, o Chat
  respondia com textos fixos.
- **Cowork** é o modo completo: split-screen (conversa à esquerda, arquivos do
  projeto sendo montados ao vivo à direita), busca profunda, leitura de
  páginas da web, envio direto pro GitHub e download em `.zip`.
- **Chat** é a versão enxuta do mesmo agente: mesmas ferramentas, sem o
  workspace de múltiplos arquivos.
- **Editor de código real no Cowork**: o painel de arquivos agora usa o
  Monaco Editor (o mesmo editor do VS Code) em vez de um `<pre>` só leitura —
  dá pra editar o código gerado antes de baixar ou enviar ao GitHub.
- **Sandbox de execução de código**: botão "Rodar" nos arquivos com linguagem
  executável (JS, TS, Python, Ruby, Go, Rust, Java, C#, PHP, Kotlin, C/C++,
  Bash) — roda de verdade, isolado, via [Piston](https://github.com/engineer-man/piston)
  (instância pública, sem chave necessária) e mostra stdout/stderr no painel.
- **Parar geração / Continuar gerando**: dá pra interromper uma resposta a
  qualquer momento, e quando ela é cortada pelo limite de tokens do modelo
  (ou você a interrompeu), aparece um botão pra continuar exatamente de onde
  parou.
- **Histórico de conversas persistido**: Chat e Cowork agora salvam e
  carregam conversas na tabela `chat_conversations`/`chat_messages` do
  Supabase (a tabela já existia; só faltava o front usar). Botão de
  histórico no cabeçalho lista, abre e apaga conversas antigas.
- **Limite de mensagens/dia (plano free)**: usuários no plano `free`
  (tabela `profiles`) têm um limite diário de mensagens (`FREE_DAILY_MESSAGE_LIMIT`,
  padrão 30); ao bater o limite, aparece um aviso convidando a assinar o Pro.
  Assinantes `pro` e admins não têm limite.
- **Rate limiting** nas rotas de IA (`/api/chat`, `/api/search`) e no sandbox
  (`/api/sandbox/run`) — protege sua conta nos provedores contra abuso caso o
  site fique público.
- **Stripe**: página de planos (`/#pricing`) com checkout de assinatura.
- **Login admin**: separado do login de usuários comuns, em `/admin`.
- Selo "Made in Bolt": não existia no código-fonte — era um overlay da própria
  hospedagem do Bolt.new. Como este projeto agora roda fora do Bolt, ele não
  aparece mais. Também removi as referências ao domínio `bolt.new` do
  `index.html`.

### Backlog (pedido, mas fora desta rodada)

- Portal do cliente Stripe (trocar cartão, cancelar assinatura).
- Multi-agente de verdade no Cowork (orquestrar mais de um modelo na mesma
  tarefa) — hoje já dá pra escolher entre Anthropic/OpenAI/Gemini/Groq/DeepSeek
  por conversa, mas não rodar vários ao mesmo tempo colaborando.
- Fila/streaming mais robusto para quando o Cowork gerar muitos arquivos ao
  mesmo tempo (hoje cada conversa processa um streaming de cada vez).

## Como rodar localmente

```bash
npm install
cp .env.example .env   # depois preencha as chaves que quiser usar
npm run dev:all         # sobe o frontend (Vite) e o backend (Express) juntos
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8787 (o Vite já faz proxy de `/api` pra ele)

Nada exige *todas* as chaves preenchidas — cada recurso liga sozinho quando a
variável correspondente existe no `.env`. Sem nenhuma chave de IA, o seletor
de modelo do Chat/Cowork aparece vazio com um aviso.

## Configurando cada recurso

| Recurso | Variáveis no `.env` | Onde conseguir |
|---|---|---|
| Login de usuários | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Painel do seu projeto Supabase |
| Chat/Cowork (IA) | `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` / `GROQ_API_KEY` / `DEEPSEEK_API_KEY` | Console de cada provedor |
| Busca profunda | `TAVILY_API_KEY` | tavily.com |
| Envio ao GitHub | `GITHUB_TOKEN` (escopo `repo`) | github.com/settings/tokens |
| Planos (Stripe) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | dashboard.stripe.com |
| Atualizar plano do usuário após pagar | `SUPABASE_SERVICE_ROLE_KEY` (+ rodar a migration `profiles`) | Painel do Supabase → Settings → API |
| Login admin | `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` | gere o hash com `npm run admin:hash -- "sua-senha"` |
| Limite diário do plano free | `FREE_DAILY_MESSAGE_LIMIT` (padrão 30) | precisa do Supabase configurado pra contar mensagens |
| Rate limiting da IA | `AI_RATE_LIMIT_WINDOW_MS`, `AI_RATE_LIMIT_MAX` | opcional — já vem com padrão razoável |
| Sandbox de execução | `PISTON_API_URL` (padrão: instância pública) | rode sua própria instância do Piston pra produção com volume alto |

Rode as migrations em `supabase/migrations/` no seu projeto Supabase (SQL
Editor ou `supabase db push`, se usar a CLI).

## Sobre a "navegação no navegador"

O botão **Ler página** faz o servidor buscar e extrair o texto de uma URL
pública — é assim que a maioria dos agentes de IA "navega". Ele não controla
o Chrome/Edge instalado na sua máquina; isso exigiria uma extensão de
navegador à parte, que não está incluída aqui.

## Deploy

Este projeto tem duas partes que rodam separadas:

1. **Frontend** (`vite build` → pasta `dist`): pode ir pra Vercel, Netlify,
   Cloudflare Pages, etc. Os arquivos `vercel.json`/`netlify.toml` incluídos
   já fazem o fallback de rotas (`/admin`, etc.) pro `index.html`.
2. **Backend** (`server/`): é um servidor Node/Express comum — rode em
   Render, Railway, Fly.io ou numa VPS (`npm run build:server && npm start`).
   Aponte `/api/*` do seu domínio pra ele (reverse proxy) e configure
   `APP_BASE_URL` com a URL pública do frontend.

## Estrutura

```
src/                 → frontend (React + Vite + Tailwind) — design original mantido
server/              → backend (Express): IA, busca, GitHub, zip, Stripe, admin
supabase/migrations/ → schema do banco (conversas, perfis/planos)
```
