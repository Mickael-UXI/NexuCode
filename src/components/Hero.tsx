import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface HeroProps {
  onNavigate: (page: 'home' | 'chat') => void;
}

export default function Hero({ onNavigate }: HeroProps) {
  const [typedText, setTypedText] = useState('');
  const fullText = 'Agentes inteligentes que escrevem código, analisam dados e automatizam processos.';

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 35);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="hero" className="relative min-h-screen flex items-center pt-16">
      <div className="max-w-6xl mx-auto px-6 w-full">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface mb-8 animate-fade-up">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
            </span>
            <span className="text-xs font-medium text-text-dim">
              Nexus IA v3.0 — disponível agora
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-[4.5rem] font-medium leading-[1.05] mb-6 animate-fade-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
            Inteligência artificial
            <br />
            que <span className="italic text-accent">constrói</span> com você.
          </h1>

          <p className="text-lg text-text-dim mb-2 min-h-[1.8em] max-w-xl animate-fade-up" style={{ animationDelay: '0.3s', opacity: 0 }}>
            {typedText}
            <span className="animate-blink text-accent">|</span>
          </p>
          <p className="text-base text-text-faint mb-10 max-w-xl animate-fade-up" style={{ animationDelay: '0.5s', opacity: 0 }}>
            Plataforma completa de agentes que cobrem todo o ciclo de
            desenvolvimento de software.
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-16 animate-fade-up" style={{ animationDelay: '0.7s', opacity: 0 }}>
            <button
              onClick={() => onNavigate('chat')}
              className="btn-primary"
            >
              <Sparkles className="w-4 h-4" />
              Iniciar conversa
            </button>
            <button
              onClick={() => document.querySelector('#services')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn-ghost"
            >
              Saiba mais
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-12 animate-fade-up" style={{ animationDelay: '0.9s', opacity: 0 }}>
            {[
              { value: '99.9%', label: 'Disponibilidade' },
              { value: '< 50ms', label: 'Latência' },
              { value: '24/7', label: 'Operacional' },
            ].map((stat, i) => (
              <div key={stat.label} className="flex flex-col">
                <span className="font-serif text-2xl font-medium text-text-main">
                  {stat.value}
                </span>
                <span className="text-xs text-text-faint mt-1">
                  {stat.label}
                </span>
                {i < 2 && (
                  <span className="hidden md:block absolute" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-bg pointer-events-none" />
    </section>
  );
}
