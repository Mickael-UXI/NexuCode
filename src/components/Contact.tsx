import { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageSquare, Check } from 'lucide-react';
import { useReveal } from '@/hooks/useReveal';

interface ContactProps {
  onNavigate: (page: 'home' | 'chat') => void;
}

export default function Contact({ onNavigate }: ContactProps) {
  const { ref, visible } = useReveal();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setForm({ name: '', email: '', message: '' });
    }, 3000);
  };

  return (
    <section id="contact" className="relative py-28 bg-surface/50">
      <div ref={ref} className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left */}
          <div className={`reveal ${visible ? 'visible' : ''}`}>
            <span className="text-xs font-medium text-accent uppercase tracking-wider">
              Contato
            </span>
            <h2 className="text-3xl md:text-4xl font-medium mt-3 mb-4">
              Vamos construir
              <br />
              algo extraordinário.
            </h2>
            <p className="text-text-dim mb-10 max-w-md">
              Tem um projeto em mente? Nossa equipe está pronta para ajudar você
              a transformar suas ideias em realidade.
            </p>

            <div className="space-y-4 mb-10">
              {[
                { icon: Mail, label: 'Email', value: 'contato@nexus-ia.com' },
                { icon: Phone, label: 'Telefone', value: '+55 (11) 4000-0000' },
                { icon: MapPin, label: 'Localização', value: 'São Paulo, Brasil' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg border border-border bg-bg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-text-dim" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="text-xs text-text-faint">{item.label}</div>
                      <div className="text-sm text-text-main font-medium">{item.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-border bg-bg p-6">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-accent" strokeWidth={1.5} />
                <span className="text-sm font-medium text-text-main">
                  Prefere conversar agora?
                </span>
              </div>
              <p className="text-sm text-text-dim mb-4">
                Fale diretamente com nosso agente IA e tire suas dúvidas em tempo real.
              </p>
              <button
                onClick={() => onNavigate('chat')}
                className="btn-primary text-sm"
              >
                <MessageSquare className="w-4 h-4" />
                Abrir chat IA
              </button>
            </div>
          </div>

          {/* Right: form */}
          <div className={`reveal ${visible ? 'visible' : ''}`}>
            <form
              onSubmit={handleSubmit}
              className="rounded-lg border border-border bg-bg p-8 space-y-5"
            >
              <div>
                <label className="block text-xs text-text-faint mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Seu nome completo"
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text-main placeholder:text-text-faint focus:border-accent/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-text-faint mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="voce@email.com"
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text-main placeholder:text-text-faint focus:border-accent/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-text-faint mb-2">
                  Mensagem
                </label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Conte-nos sobre seu projeto..."
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text-main placeholder:text-text-faint focus:border-accent/50 focus:outline-none transition-colors resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={sent}
                className="btn-primary w-full justify-center disabled:opacity-50"
              >
                {sent ? (
                  <>
                    <Check className="w-4 h-4" />
                    Mensagem enviada
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar mensagem
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
