import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { createCheckoutSession } from '@/lib/api';

interface PricingProps {
  session: Session | null;
  onRequireLogin: () => void;
}

const plans = [
  {
    id: 'monthly' as const,
    name: 'Mensal',
    price: 'R$ 49/mês',
    features: ['Nexus Chat ilimitado', 'Modo Cowork', 'Busca profunda e leitura de páginas', 'Envio de projetos ao GitHub'],
  },
  {
    id: 'yearly' as const,
    name: 'Anual',
    price: 'R$ 39/mês',
    highlight: true,
    features: ['Tudo do plano mensal', '2 meses grátis', 'Suporte prioritário'],
  },
];

export default function Pricing({ session, onRequireLogin }: PricingProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (planId: 'monthly' | 'yearly') => {
    if (!session) return onRequireLogin();
    setLoadingPlan(planId);
    try {
      const { url } = await createCheckoutSession(planId, session.user.email ?? undefined, session.user.id);
      window.location.href = url;
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section id="pricing" className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-serif font-medium text-text-main mb-3">Planos</h2>
          <p className="text-text-dim">Escolha o plano ideal para usar o Nexus Chat e o Cowork sem limites.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border p-8 ${plan.highlight ? 'border-accent bg-accent-bg' : 'border-border bg-surface/50'}`}
            >
              <h3 className="text-lg font-medium text-text-main mb-1">{plan.name}</h3>
              <p className="text-2xl font-serif font-medium text-text-main mb-5">{plan.price}</p>
              <ul className="space-y-2.5 mb-7">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-dim">
                    <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan === plan.id}
                className="btn-primary w-full justify-center disabled:opacity-60"
              >
                {loadingPlan === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Assinar {plan.name.toLowerCase()}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-faint text-center mt-6">
          Requer STRIPE_SECRET_KEY e os Price IDs configurados no .env do servidor.
        </p>
      </div>
    </section>
  );
}
