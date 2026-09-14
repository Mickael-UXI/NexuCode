import { Target, Eye, Rocket, CheckCircle2 } from 'lucide-react';
import { useReveal } from '@/hooks/useReveal';

const pillars = [
  {
    icon: Target,
    title: 'Missão',
    text: 'Democratizar o acesso a inteligência artificial de ponta, permitindo que qualquer pessoa construa software de qualidade profissional sem barreiras técnicas.',
  },
  {
    icon: Eye,
    title: 'Visão',
    text: 'Ser a plataforma líder em agentes IA autônomos, onde humanos e máquinas colaboram para criar soluções que antes pareciam impossíveis.',
  },
  {
    icon: Rocket,
    title: 'Valores',
    text: 'Inovação responsável, transparência em cada decisão automatizada, e segurança como pilar fundamental de tudo o que construímos.',
  },
];

const highlights = [
  'Agentes que aprendem com seu estilo de código',
  'Integração com suas ferramentas favoritas',
  'Documentação automática em tempo real',
  'Testes gerados e mantidos por IA',
  'Monitoramento e alertas inteligentes',
  'Suporte a múltiplos modelos de IA',
];

export default function About() {
  const { ref, visible } = useReveal();

  return (
    <section id="about" className="relative py-28">
      <div ref={ref} className="max-w-6xl mx-auto px-6">
        <div className={`max-w-2xl mb-16 reveal ${visible ? 'visible' : ''}`}>
          <span className="text-xs font-medium text-accent uppercase tracking-wider">
            Sobre
          </span>
          <h2 className="text-3xl md:text-4xl font-medium mt-3 mb-4">
            A força por trás da
            <br />
            Nexus IA.
          </h2>
          <p className="text-text-dim">
            Uma plataforma nascida da convicção de que inteligência artificial
            deve ser acessível, segura e poderosa para todos.
          </p>
        </div>

        {/* Pillars */}
        <div className="grid md:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border mb-12">
          {pillars.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className={`bg-bg p-8 card-hover ${visible ? 'animate-fade-up' : 'opacity-0'}`}
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                <div className="w-10 h-10 rounded-lg border border-border bg-surface flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-accent" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-medium text-text-main mb-3 font-sans">
                  {pillar.title}
                </h3>
                <p className="text-sm text-text-dim leading-relaxed">
                  {pillar.text}
                </p>
              </div>
            );
          })}
        </div>

        {/* Highlights */}
        <div className={`rounded-lg border border-border bg-surface/50 p-8 lg:p-10 reveal ${visible ? 'visible' : ''}`}>
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-4">
            {highlights.map((item, i) => (
              <div
                key={item}
                className={`flex items-start gap-3 ${visible ? 'animate-fade-up' : 'opacity-0'}`}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <span className="text-sm text-text-dim">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
