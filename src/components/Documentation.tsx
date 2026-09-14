import { useState } from 'react';
import {
  ArrowLeft,
  Rocket,
  MessageSquare,
  Layers,
  Cpu,
  Search,
  Globe,
  Github,
  Play,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

interface DocumentationProps {
  onNavigate: (page: 'home' | 'chat' | 'cowork' | 'docs' | 'api' | 'how-it-works') => void;
}

const sections = [
  { id: 'inicio', label: 'Primeiros passos', icon: Rocket },
  { id: 'modos', label: 'Chat vs. Cowork', icon: Layers },
  { id: 'modelos', label: 'Modelos de IA', icon: Cpu },
  { id: 'ferramentas', label: 'Ferramentas', icon: Search },
  { id: 'seguranca', label: 'Contas e segurança', icon: ShieldCheck },
];

export default function Documentation({ onNavigate }: DocumentationProps) {
  const [active, setActive] = useState('inicio');

  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-bg text-text-main">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => onNavigate('home')} className="p-1.5 text-text-dim hover:text-text-main transition-colors">
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <span className="font-serif text-base font-medium">Documentação</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('how-it-works')}
              className="text-xs text-text-dim hover:text-text-main transition-colors px-2.5 py-1.5"
            >
              Como funciona
            </button>
            <button
              onClick={() => onNavigate('api')}
              className="text-xs text-text-dim hover:text-text-main transition-colors px-2.5 py-1.5"
            >
              Referência da API
            </button>
            <ThemeToggle />
            <button
              onClick={() => onNavigate('chat')}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-text-main text-bg hover:bg-accent transition-colors"
            >
              Abrir chat
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-[220px_1fr] gap-10">
        {/* Sumário lateral */}
        <nav className="hidden md:block">
          <div className="sticky top-24 space-y-0.5">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                  active === s.id ? 'bg-accent-bg text-accent' : 'text-text-dim hover:text-text-main hover:bg-surface'
                }`}
              >
                <s.icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Conteúdo */}
        <div className="min-w-0 space-y-16">
          <section id="inicio" className="scroll-mt-24">
            <h1 className="font-serif text-3xl font-medium mb-3">Primeiros passos</h1>
            <p className="text-text-dim leading-relaxed mb-4">
              O Nexus tem dois jeitos de trabalhar: o <strong className="text-text-main">Chat</strong>, rápido e direto para
              perguntas e trechos de código, e o <strong className="text-text-main">Cowork</strong>, pensado para projetos
              com vários arquivos, execução de código e integração com GitHub.
            </p>
            <ol className="space-y-3 text-sm text-text-dim">
              <li className="flex gap-2"><span className="text-accent font-medium">1.</span> Crie sua conta ou entre pelo botão "Chat IA" no topo do site.</li>
              <li className="flex gap-2"><span className="text-accent font-medium">2.</span> Escolha um modelo de IA disponível (depende das chaves configuradas no servidor).</li>
              <li className="flex gap-2"><span className="text-accent font-medium">3.</span> Descreva o que você precisa — para projetos maiores, mude para o Cowork.</li>
            </ol>
          </section>

          <section id="modos" className="scroll-mt-24">
            <h2 className="font-serif text-2xl font-medium mb-3">Chat vs. Cowork</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border p-5 bg-surface/40">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-accent" strokeWidth={1.5} />
                  <h3 className="font-medium text-text-main text-sm">Chat</h3>
                </div>
                <p className="text-sm text-text-dim leading-relaxed">
                  Conversa única, sem painel lateral. Ideal para dúvidas rápidas, explicações e trechos curtos de código.
                </p>
              </div>
              <div className="rounded-xl border border-border p-5 bg-surface/40">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-accent" strokeWidth={1.5} />
                  <h3 className="font-medium text-text-main text-sm">Cowork</h3>
                </div>
                <p className="text-sm text-text-dim leading-relaxed">
                  A conversa começa em coluna única, igual ao Chat. Assim que a IA passa a entregar um arquivo ou
                  escrever código, a tela se divide automaticamente: a conversa continua à esquerda e um editor
                  (com abas por arquivo, execução em sandbox e histórico) abre à direita — sem precisar pedir.
                </p>
              </div>
            </div>
          </section>

          <section id="modelos" className="scroll-mt-24">
            <h2 className="font-serif text-2xl font-medium mb-3">Modelos de IA</h2>
            <p className="text-text-dim text-sm leading-relaxed mb-4">
              O seletor de modelo só mostra provedores com uma chave de API configurada no <code className="text-xs bg-surface-2 px-1.5 py-0.5 rounded">.env</code> do
              servidor. Nenhuma chave vem "de fábrica" habilitada.
            </p>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface text-text-faint text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Provedor</th>
                    <th className="text-left px-4 py-2.5 font-medium">Variável no .env</th>
                    <th className="text-left px-4 py-2.5 font-medium">Bom para</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ['Anthropic (Claude)', 'ANTHROPIC_API_KEY', 'Código e raciocínio geral'],
                    ['OpenAI (GPT)', 'OPENAI_API_KEY', 'Código e uso geral'],
                    ['Google (Gemini)', 'GEMINI_API_KEY', 'Contexto grande, visão'],
                    ['Groq (Llama)', 'GROQ_API_KEY', 'Velocidade de resposta'],
                    ['DeepSeek', 'DEEPSEEK_API_KEY', 'Custo baixo, raciocínio (R1)'],
                    ['NVIDIA NIM (Nemotron)', 'NVIDIA_API_KEY', 'Diálogo ajustado por RLHF'],
                  ].map(([name, envVar, goodFor]) => (
                    <tr key={envVar}>
                      <td className="px-4 py-2.5 text-text-main">{name}</td>
                      <td className="px-4 py-2.5"><code className="text-xs bg-surface-2 px-1.5 py-0.5 rounded">{envVar}</code></td>
                      <td className="px-4 py-2.5 text-text-dim">{goodFor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="ferramentas" className="scroll-mt-24">
            <h2 className="font-serif text-2xl font-medium mb-3">Ferramentas disponíveis</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Search, title: 'Busca profunda', desc: 'Pesquisa na web em tempo real antes de responder, quando ativada no composer.' },
                { icon: Globe, title: 'Ler página', desc: 'Envia o conteúdo de uma URL para o contexto da conversa.' },
                { icon: Play, title: 'Sandbox de execução', desc: 'Roda o código gerado direto no painel do Cowork, via Piston.' },
                { icon: Github, title: 'Integração com GitHub', desc: 'Envia os arquivos montados no Cowork direto para um repositório.' },
              ].map((t) => (
                <div key={t.title} className="rounded-xl border border-border p-5 bg-surface/40">
                  <div className="flex items-center gap-2 mb-2">
                    <t.icon className="w-4 h-4 text-accent" strokeWidth={1.5} />
                    <h3 className="font-medium text-text-main text-sm">{t.title}</h3>
                  </div>
                  <p className="text-sm text-text-dim leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="seguranca" className="scroll-mt-24">
            <h2 className="font-serif text-2xl font-medium mb-3">Contas e segurança</h2>
            <p className="text-text-dim text-sm leading-relaxed">
              A autenticação é feita via Supabase. Suas chaves de API de provedores de IA ficam apenas no servidor
              (nunca no navegador) e cada mensagem passa por um limite de requisições para evitar abuso. Contas no
              plano gratuito têm um limite diário de mensagens; o plano Pro remove esse limite.
            </p>
          </section>

          <div className="pt-6 border-t border-border flex items-center justify-between text-sm">
            <button onClick={() => onNavigate('how-it-works')} className="flex items-center gap-1 text-text-dim hover:text-accent transition-colors">
              Como funciona o chat por dentro <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onNavigate('api')} className="flex items-center gap-1 text-text-dim hover:text-accent transition-colors">
              Referência da API <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
