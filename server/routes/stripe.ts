import { Router, raw } from 'express';
import Stripe from 'stripe';
import { env } from '../lib/env.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

export const stripeRouter = Router();

function getStripe() {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY);
}

/** Cria uma sessão de Checkout pro plano escolhido (monthly | yearly). */
stripeRouter.post('/stripe/create-checkout-session', async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(400).json({ error: 'STRIPE_SECRET_KEY não configurada no .env.' });

  const { plan, email, userId } = req.body as { plan: 'monthly' | 'yearly'; email?: string; userId?: string };
  const priceId = plan === 'yearly' ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_MONTHLY;
  if (!priceId) {
    return res.status(400).json({ error: `Defina STRIPE_PRICE_${plan === 'yearly' ? 'YEARLY' : 'MONTHLY'} no .env com o ID do Price criado no Stripe.` });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,
      success_url: `${env.APP_BASE_URL}/?checkout=success`,
      cancel_url: `${env.APP_BASE_URL}/?checkout=cancelled`,
      metadata: { userId: userId || '' },
    });
    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao criar sessão de checkout.' });
  }
});

/**
 * Webhook do Stripe. Precisa do corpo *cru* (raw) pra validar a assinatura,
 * por isso usa express.raw() só nesta rota (ver server/index.ts).
 */
stripeRouter.post('/stripe/webhook', raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send('Stripe não configurado.');
  }

  const signature = req.headers['stripe-signature'];
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature as string, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return res.status(400).send(`Assinatura inválida: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const supabaseAdmin = getSupabaseAdmin();
    if (userId && supabaseAdmin) {
      await supabaseAdmin
        .from('profiles')
        .update({ plan: 'pro', stripe_customer_id: session.customer as string })
        .eq('id', userId);
    }
  }

  res.json({ received: true });
});
