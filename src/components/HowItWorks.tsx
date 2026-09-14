import { ArrowLeft, User, Cpu, Wrench, Waves, Database, MonitorSmartphone } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

interface HowItWorksProps {
  onNavigate: (page: 'home' | 'chat' | 'cowork' | 'docs' | 'api' | 'how-it-works') => void;
}

const steps = [
  {
    icon: User,
    title: '1. Você envia uma mensagem',
    text: 'O texto (e o histórico da conversa) sai do navegador e chega no servidor do Nexus por HTTPS. Nada é enviado direto do seu navegador para OpenAI, Anthropic, Google etc. — o servidor é o único que fala com esses provedores.',
  },
  {
    icon: Cpu,
    title: '2. O modelo certo é escolhido',
    text: 'O servidor confere qual provedor você selecionou (Claude, GPT, Gemini, Llama via Groq, DeepSeek ou NVIDIA/Nemotron) e verifica se a chave de API correspondente está configurada.',
  },
  {
    icon: Wrench,
    title: '3. Ferramentas entram em ação (se ativadas)',
    text: 'Se "Busca profunda" ou "Ler página" estiverem ligadas, o servidor primeiro busca esse contexto (via Tavily ou leitura direta da URL) e injeta o resultado na conversa antes de chamar a IA.',
  },
  {
    icon: Waves,
    title: '4. A resposta chega em streaming',
    text: 'A IA não responde tudo de uma vez: o servidor abre uma conexão de streaming (Server-Sent Events) e cada pedacinho do texto aparece na tela assim que é gerado — por isso a resposta "digita" ao vivo.',
  },
  {
    icon: MonitorSmartphone,
    title: '5. Código e arquivos ganham um painel próprio',
    text: 'No modo Cowork, se a resposta contém um arquivo ou bloco de código, a tela se divide automaticamente: a conversa continua à esquerda, e um editor com abas, syntax highlight e botão de "Rodar" (sandbox) abre à direita.',
  },
  {
    icon: Database,
    title: '6. Tudo fica salvo na sua conta',
    text: 'Mensagens e conversas ficam guardadas no Supabase, associadas à sua conta — por isso o histórico aparece de novo se você sair e voltar, em qualquer dispositivo.',
  },
];

export default function HowItWorks({ onNavigate }: HowItWorksProps) {
  return (
    <div className="min-h-screen bg-bg text-text-main">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => onNavigate('docs')} className="p-1.5 text-text-dim hover:text-text-main transition-colors">
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
            <span className="font-serif text-base font-medium">Como funciona o chat</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-serif text-3xl font-medium mb-3">O caminho de uma mensagem</h1>
        <p className="text-text-dim leading-relaxed mb-12">
          Um resumo, sem jargão, do que acontece entre você apertar "enviar" e a resposta aparecer na tela.
        </p>

        <div className="space-y-8">
          {steps.map((s, i) => (
            <div key={s.title} className="flex gap-4">
              <div className="flex flex-col items-center flex-shrink-0">
                <span className="w-9 h-9 rounded-lg bg-text-main flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-bg" strokeWidth={1.5} />
                </span>
                {i < steps.length - 1 && <span className="w-px flex-1 bg-border mt-2" />}
              </div>
              <div className="pb-2">
                <h3 className="font-medium text-text-main mb-1.5">{s.title}</h3>
                <p className="text-sm text-text-dim leading-relaxed max-w-lg">{s.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-3">
          <button
            onClick={() => onNavigate('docs')}
            className="btn-ghost"
          >
            Ver documentação completa
          </button>
          <button
            onClick={() => onNavigate('chat')}
            className="btn-primary"
          >
            Experimentar o chat
          </button>
        </div>
      </div>
    </div>
  );
}
