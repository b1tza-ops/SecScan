import { Router } from 'express';
import Stripe from 'stripe';
import { pool } from '../models/db.js';
import { requireAuth } from '../middleware/auth.js';

export const subscriptionRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO,
  agency: process.env.STRIPE_PRICE_AGENCY,
};

const PLAN_FROM_PRICE = {};
if (process.env.STRIPE_PRICE_PRO) PLAN_FROM_PRICE[process.env.STRIPE_PRICE_PRO] = 'pro';
if (process.env.STRIPE_PRICE_AGENCY) PLAN_FROM_PRICE[process.env.STRIPE_PRICE_AGENCY] = 'agency';

subscriptionRouter.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!['pro', 'agency'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });

    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = rows[0];

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.full_name });
      customerId = customer.id;
      await pool.query('UPDATE users SET stripe_customer_id=$1 WHERE id=$2', [customerId, user.id]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: { userId: user.id, plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

subscriptionRouter.post('/portal', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT stripe_customer_id FROM users WHERE id=$1', [req.user.id]);
    if (!rows[0].stripe_customer_id) return res.status(400).json({ error: 'No subscription found' });

    const session = await stripe.billingPortal.sessions.create({
      customer: rows[0].stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    });
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// Stripe webhook — raw body required
subscriptionRouter.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).send('Webhook signature verification failed');
  }

  // Idempotency: skip already-processed events
  try {
    const { rowCount } = await pool.query(
      'INSERT INTO stripe_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [event.id]
    );
    if (rowCount === 0) return res.json({ received: true, duplicate: true });
  } catch {
    // If table doesn't exist yet, continue processing
  }

  const obj = event.data.object;

  if (event.type === 'checkout.session.completed') {
    const { userId, plan } = obj.metadata || {};
    if (userId && plan) {
      await pool.query('UPDATE users SET plan=$1, stripe_subscription_id=$2 WHERE id=$3', [plan, obj.subscription, userId]);
      await pool.query(
        'INSERT INTO subscriptions (user_id, stripe_subscription_id, plan, status) VALUES ($1,$2,$3,$4) ON CONFLICT (stripe_subscription_id) DO UPDATE SET plan=$3, status=$4',
        [userId, obj.subscription, plan, 'active']
      );
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const priceId = obj.items?.data?.[0]?.price?.id;
    const newPlan = PLAN_FROM_PRICE[priceId];
    if (newPlan) {
      await pool.query("UPDATE users SET plan=$1 WHERE stripe_subscription_id=$2", [newPlan, obj.id]);
      await pool.query("UPDATE subscriptions SET plan=$1, status=$2 WHERE stripe_subscription_id=$3", [newPlan, obj.status, obj.id]);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    await pool.query("UPDATE users SET plan='free', stripe_subscription_id=NULL WHERE stripe_subscription_id=$1", [obj.id]);
    await pool.query("UPDATE subscriptions SET status='cancelled' WHERE stripe_subscription_id=$1", [obj.id]);
  }

  res.json({ received: true });
});
