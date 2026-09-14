import { useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Services from '@/components/Services';
import Features from '@/components/Features';
import Pricing from '@/components/Pricing';
import About from '@/components/About';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';
import Chat from '@/components/Chat';
import Cowork from '@/components/Cowork';
import Auth from '@/components/Auth';
import AdminLogin from '@/components/AdminLogin';
import AdminDashboard from '@/components/AdminDashboard';
import Documentation from '@/components/Documentation';
import ApiDocs from '@/components/ApiDocs';
import HowItWorks from '@/components/HowItWorks';
import Projects from '@/components/Projects';
import Artifacts from '@/components/Artifacts';
import AccountSettings from '@/components/AccountSettings';
import { supabase } from '@/lib/supabase';
import { getLastPage, setLastPage } from '@/lib/localState';

type Page =
  | 'home'
  | 'chat'
  | 'cowork'
  | 'design'
  | 'auth'
  | 'admin-login'
  | 'admin'
  | 'docs'
  | 'api'
  | 'how-it-works'
  | 'projects'
  | 'artifacts'
  | 'account';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  // O listener do onAuthStateChange abaixo é registrado uma única vez (no mount) e por isso
  // fecha sobre o valor de `page` daquele instante — sem essa ref, a comparação `page === 'auth'`
  // dentro dele nunca reflete navegações feitas depois (stale closure), e o redirecionamento
  // pós-login não acontecia.
  const pageRef = useRef<Page>(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
      // Se o usuário estava no Chat ou no Cowork antes de recarregar a página,
      // volta pra lá em vez de jogar de volta pra home — a conversa em si é
      // restaurada dentro de cada componente (ver lib/localState.ts).
      if (data.session && window.location.pathname !== '/admin') {
        const restored = getLastPage();
        if (restored) setPage(restored);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession && pageRef.current === 'auth') setPage('chat');
      if (!nextSession) setLastPage(null);
    });

    if (window.location.pathname === '/admin') setPage('admin-login');

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavigate = (
    newPage:
      | 'home'
      | 'chat'
      | 'cowork'
      | 'design'
      | 'docs'
      | 'api'
      | 'how-it-works'
      | 'projects'
      | 'artifacts'
      | 'account'
  ) => {
    const requiresAuth =
      newPage === 'chat' || newPage === 'cowork' || newPage === 'design' || newPage === 'projects' || newPage === 'artifacts' || newPage === 'account';
    if (requiresAuth && !session) {
      setPage('auth');
    } else {
      setPage(newPage);
    }
    setLastPage(newPage === 'chat' || newPage === 'cowork' || newPage === 'design' ? newPage : null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  if (authLoading) {
    return <div className="min-h-screen bg-bg flex items-center justify-center" />;
  }

  if (page === 'admin-login') {
    return (
      <AdminLogin
        onBack={() => setPage('home')}
        onSuccess={() => {
          setIsAdmin(true);
          setPage('admin');
        }}
      />
    );
  }

  if (page === 'admin' && isAdmin) {
    return <AdminDashboard onLogout={() => { setIsAdmin(false); setPage('home'); }} />;
  }

  if (page === 'auth') {
    return (
      <Auth
        onBack={() => handleNavigate('home')}
        onSuccess={() => {
          setLastPage('chat');
          setPage('chat');
        }}
      />
    );
  }

  if (page === 'chat' && session) {
    return <Chat onNavigate={handleNavigate} session={session} />;
  }

  if (page === 'cowork' && session) {
    return <Cowork onNavigate={handleNavigate} session={session} />;
  }

  if (page === 'design' && session) {
    return <Cowork onNavigate={handleNavigate} session={session} variant="design" />;
  }

  if (page === 'docs') {
    return <Documentation onNavigate={handleNavigate} />;
  }

  if (page === 'api') {
    return <ApiDocs onNavigate={handleNavigate} />;
  }

  if (page === 'how-it-works') {
    return <HowItWorks onNavigate={handleNavigate} />;
  }

  if (page === 'projects' && session) {
    return <Projects onNavigate={handleNavigate} session={session} />;
  }

  if (page === 'artifacts' && session) {
    return <Artifacts onNavigate={handleNavigate} session={session} />;
  }

  if (page === 'account' && session) {
    return <AccountSettings onNavigate={handleNavigate} session={session} />;
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar onNavigate={handleNavigate} currentPage={page === 'home' ? 'home' : 'chat'} />
      <main>
        <Hero onNavigate={handleNavigate} />
        <Services />
        <Features />
        <Pricing session={session} onRequireLogin={() => setPage('auth')} />
        <About />
        <Contact onNavigate={handleNavigate} />
      </main>
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
