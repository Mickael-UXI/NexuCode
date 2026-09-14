import { Zap, GitBranch, Lock, Gauge, Layers, Bot } from 'lucide-react';
import { useReveal } from '@/hooks/useReveal';

const features = [
  {
    icon: Bot,
    title: 'Agentes multi-propósito',
    description:
      'Configure agentes especializados para code review, debug, testes, documentação e mais.',
  },
  {
    icon: Zap,
    title: 'Resposta em tempo real',
    description:
      'Streaming de respostas com latência inferior a 50ms para uma conversação fluida.',
  },
  {
    icon: GitBranch,
    title: 'Versionamento integrado',
    description:
      'Controle de versão nativo com diffs, branches e merge automático gerenciados por IA.',
  },
  {
    icon: Lock,
    title: 'Privacidade total',
    description:
      'Seus dados nunca são compartilhados. Criptografia ponta a ponta em toda comunicação.',
  },
  {
    icon: Gauge,
    title: 'Performance otimizada',
    description:
      'Modelos otimizados para velocidade e eficiência, reduzindo custo sem perder qualidade.',
  },
  {
    icon: Layers,
    title: 'Arquitetura extensível',
    description:
      'Adicione seus próprios agentes, ferramentas e integrações através da API aberta.',
  },
];

const stats = [
  { value: '1M+', label: 'Linhas de código geradas' },
  { value: '50K+', label: 'Agentes ativos' },
  { value: '99.9%', label: 'Disponibilidade' },
  { value: '180+', label: 'Países atendidos' },
];

export default function Features() {
  const { ref, visible } = useReveal();

  return (
    <section id="features" className="relative py-28 bg-surface/50">
      <div ref={ref} className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left */}
          <div className={`reveal ${visible ? 'visible' : ''}`}>
            <span className="text-xs font-medium text-accent uppercase tracking-wider">
              Recursos
            </span>
            <h2 className="text-3xl md:text-4xl font-medium mt-3 mb-4">
              Construído para
              <br />
              escalar com você.
            </h2>
            <p className="text-text-dim mb-10 max-w-md">
              Cada recurso foi pensado para maximizar produtividade sem
              comprometer segurança ou performance.
            </p>

            <div className="grid grid-cols-2 gap-px bg-border rounded-lg overflow-hidden border border-border max-w-md">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-bg p-6 card-hover">
                  <div className="font-serif text-2xl font-medium text-text-main">
                    {stat.value}
                  </div>
                  <div className="text-xs text-text-faint mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="space-y-px bg-border rounded-lg overflow-hidden border border-border">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`group flex gap-4 bg-bg p-6 card-hover ${visible ? 'animate-fade-up' : 'opacity-0'}`}
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg border border-border bg-surface flex items-center justify-center group-hover:border-accent/30 transition-colors">
                    <Icon className="w-4.5 h-4.5 text-text-dim group-hover:text-accent transition-colors" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-text-main mb-1 font-sans">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-text-dim leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
