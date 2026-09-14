import { Github, Twitter, Linkedin, Mail } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: 'home' | 'chat' | 'docs' | 'api' | 'how-it-works') => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  const year = new Date().getFullYear();

  const links = {
    Produto: ['Serviços', 'Recursos', 'Chat IA', 'Preços'],
    Empresa: ['Sobre', 'Blog', 'Carreiras', 'Contato'],
    Recursos: ['Documentação', 'API', 'Como funciona', 'Status'],
    Legal: ['Privacidade', 'Termos', 'Cookies', 'LGPD'],
  };

  return (
    <footer className="border-t border-border bg-bg">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid lg:grid-cols-6 gap-10 mb-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-md bg-text-main flex items-center justify-center">
                <span className="text-bg font-serif font-semibold text-sm">N</span>
              </span>
              <span className="font-serif text-lg font-medium text-text-main">
                Nexus
              </span>
            </div>
            <p className="text-sm text-text-dim max-w-xs mb-5">
              Plataforma de agentes inteligentes que constroem, automatizam e
              transformam o futuro do desenvolvimento de software.
            </p>
            <div className="flex gap-2">
              {[Github, Twitter, Linkedin, Mail].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 rounded-lg border border-border bg-surface flex items-center justify-center text-text-dim hover:text-accent hover:border-accent/30 transition-all"
                >
                  <Icon className="w-4 h-4" strokeWidth={1.5} />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-sm font-medium text-text-main mb-4 font-sans">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item}>
                    <button
                      onClick={() => {
                        if (item === 'Chat IA') {
                          onNavigate('chat');
                        } else if (item === 'Documentação') {
                          onNavigate('docs');
                        } else if (item === 'API') {
                          onNavigate('api');
                        } else if (item === 'Como funciona') {
                          onNavigate('how-it-works');
                        } else {
                          onNavigate('home');
                          setTimeout(() => {
                            const sectionMap: Record<string, string> = {
                              'Serviços': '#services',
                              'Recursos': '#features',
                              'Sobre': '#about',
                              'Contato': '#contact',
                            };
                            const selector = sectionMap[item];
                            if (selector) {
                              document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' });
                            }
                          }, 100);
                        }
                      }}
                      className="text-sm text-text-dim hover:text-text-main transition-colors"
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-text-faint">
            © {year} Nexus Code & Agent IA. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <p className="text-xs text-text-faint">
              Feito com inteligência artificial no Brasil
            </p>
            <a href="/admin" className="text-xs text-text-faint hover:text-text-dim transition-colors">
              Admin
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
