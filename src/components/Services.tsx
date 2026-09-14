import { Code2, Brain, Workflow, ShieldCheck, Database, Cloud } from 'lucide-react';
import { useReveal } from '@/hooks/useReveal';

const services = [
  {
    icon: Code2,
    title: 'Geração de código',
    description:
      'Agentes que escrevem, revisam e otimizam código em múltiplas linguagens com precisão.',
    tags: ['TypeScript', 'Python', 'Rust', 'Go'],
  },
  {
    icon: Brain,
    title: 'Raciocínio autônomo',
    description:
      'Decomposição de problemas complexos, planejamento de soluções e execução passo a passo.',
    tags: ['Chain-of-Thought', 'Planning', 'Reflection'],
  },
  {
    icon: Workflow,
    title: 'Automação inteligente',
    description:
      'Fluxos automatizados que conectam APIs, processam dados e tomam decisões em tempo real.',
    tags: ['APIs', 'Webhooks', 'Pipelines'],
  },
  {
    icon: ShieldCheck,
    title: 'Segurança embutida',
    description:
      'Validação automática de código, detecção de vulnerabilidades e melhores práticas.',
    tags: ['OWASP', 'SAST', 'Audit'],
  },
  {
    icon: Database,
    title: 'Análise de dados',
    description:
      'Consulta, análise e visualização de grandes volumes de dados com insights acionáveis.',
    tags: ['SQL', 'Analytics', 'Reports'],
  },
  {
    icon: Cloud,
    title: 'Deploy contínuo',
    description:
      'Publicação automatizada para produção com rollback inteligente e monitoramento.',
    tags: ['CI/CD', 'Docker', 'K8s'],
  },
];

export default function Services() {
  const { ref, visible } = useReveal();

  return (
    <section id="services" className="relative py-28">
      <div ref={ref} className="max-w-6xl mx-auto px-6">
        <div className={`max-w-2xl mb-16 reveal ${visible ? 'visible' : ''}`}>
          <span className="text-xs font-medium text-accent uppercase tracking-wider">
            Serviços
          </span>
          <h2 className="text-3xl md:text-4xl font-medium mt-3 mb-4">
            Tudo o que sua equipe precisa,
            <br />
            potenciado por IA.
          </h2>
          <p className="text-text-dim">
            Uma suíte completa de agentes inteligentes que cobrem todo o ciclo
            de desenvolvimento de software.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
          {services.map((service, i) => {
            const Icon = service.icon;
            return (
              <div
                key={service.title}
                className={`group bg-bg p-8 card-hover ${visible ? 'animate-fade-up' : 'opacity-0'}`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="w-10 h-10 rounded-lg border border-border bg-surface flex items-center justify-center mb-5 group-hover:border-accent/30 transition-colors">
                  <Icon className="w-5 h-5 text-text-dim group-hover:text-accent transition-colors" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-medium text-text-main mb-2 font-sans">
                  {service.title}
                </h3>
                <p className="text-sm text-text-dim leading-relaxed mb-5">
                  {service.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {service.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 text-xs text-text-faint bg-surface border border-border rounded-md"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
