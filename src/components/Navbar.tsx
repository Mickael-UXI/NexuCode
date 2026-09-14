import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import ThemeToggle from '@/components/ThemeToggle';

interface NavbarProps {
  onNavigate: (page: 'home' | 'chat' | 'cowork' | 'docs' | 'api' | 'how-it-works') => void;
  currentPage: 'home' | 'chat';
}

export default function Navbar({ onNavigate, currentPage }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Início', href: '#hero' },
    { label: 'Serviços', href: '#services' },
    { label: 'Recursos', href: '#features' },
    { label: 'Planos', href: '#pricing' },
    { label: 'Sobre', href: '#about' },
    { label: 'Contato', href: '#contact' },
  ];

  const handleLinkClick = (href: string) => {
    setMobileOpen(false);
    if (currentPage !== 'home') {
      onNavigate('home');
      setTimeout(() => {
        document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-bg/85 backdrop-blur-md border-b border-border'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 group"
          >
            <span className="w-7 h-7 rounded-md bg-text-main flex items-center justify-center transition-transform group-hover:scale-105">
              <span className="text-bg font-serif font-semibold text-sm">N</span>
            </span>
            <span className="font-serif text-lg font-medium text-text-main tracking-tight">
              Nexus
            </span>
          </button>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => handleLinkClick(link.href)}
                className="px-3.5 py-1.5 text-sm text-text-dim hover:text-text-main transition-colors duration-200"
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => onNavigate('docs')}
              className="px-3.5 py-1.5 text-sm text-text-dim hover:text-text-main transition-colors duration-200"
            >
              Documentação
            </button>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={() => onNavigate('cowork')}
              className="text-sm text-text-dim hover:text-text-main transition-colors duration-200"
            >
              Cowork
            </button>
            <button
              onClick={() => onNavigate('chat')}
              className="text-sm font-medium text-text-main hover:text-accent transition-colors duration-200 flex items-center gap-1.5"
            >
              Chat IA
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft" />
            </button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              className="text-text-main p-1"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 animate-fade-in">
            <div className="flex flex-col gap-0.5">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleLinkClick(link.href)}
                  className="px-3 py-2.5 text-left text-sm text-text-dim hover:text-text-main transition-colors rounded-md hover:bg-surface"
                >
                  {link.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setMobileOpen(false);
                  onNavigate('docs');
                }}
                className="px-3 py-2.5 text-left text-sm text-text-dim hover:text-text-main transition-colors rounded-md hover:bg-surface"
              >
                Documentação
              </button>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  onNavigate('cowork');
                }}
                className="px-3 py-2.5 text-left text-sm text-text-dim"
              >
                Cowork
              </button>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  onNavigate('chat');
                }}
                className="px-3 py-2.5 text-left text-sm text-accent font-medium"
              >
                Chat IA →
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
