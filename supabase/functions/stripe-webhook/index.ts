// supabase/functions/stripe-webhook/index.ts
// @ts-nocheck
// Handles incoming Stripe webhook events.  This function is NOT invoked by the
// frontend — Stripe calls it directly as a webhook endpoint.
//
// Register the webhook in the Stripe Dashboard pointing to:
//   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//
// Required Supabase secret env vars:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET  — the whsec_... value from Stripe > Webhooks

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const stripeKey     = Deno.env.get("STRIPE_SECRET_KEY")!;
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const supabaseUrl   = Deno.env.get("SUPABASE_URL")!;
  const serviceKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });

  // Stripe requires the raw body for signature verification.
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", (err as Error).message);
    return json({ error: `Webhook Error: ${(err as Error).message}` }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const supabaseUid = session.metadata?.supabaseUid;
        if (supabaseUid && session.customer && session.subscription) {
          await supabase
            .from("users")
            .update({
              stripe_customer_id:    session.customer as string,
              stripe_subscription_id: session.subscription as string,
              subscription_status:   "active",
            })
            .eq("supabase_uid", supabaseUid);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        // If the subscription is marked to cancel at period end, reflect that.
        const derivedStatus = sub.cancel_at_period_end ? "canceling" : sub.status;
        await supabase
          .from("users")
          .update({
            subscription_status:    derivedStatus,
            stripe_subscription_id: sub.id,
          })
          .eq("stripe_customer_id", sub.customer as string);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supabase
          .from("users")
          .update({
            subscription_status:    "canceled",
            stripe_subscription_id: null,
          })
          .eq("stripe_customer_id", sub.customer as string);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // Only count subscription payments (not zero-amount setup invoices).
        if (invoice.amount_paid > 0 && invoice.subscription) {
          const now       = new Date();
          const month     = now.getUTCMonth() + 1;
          const year      = now.getUTCFullYear();
          const amountEur = invoice.amount_paid / 100;

          const { data: existing } = await supabase
            .from("monthly_stats")
            .select("revenue, payments")
            .eq("year",  year)
            .eq("month", month)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("monthly_stats")
              .update({
                revenue:  existing.revenue  + amountEur,
                payments: existing.payments + 1,
              })
              .eq("year",  year)
              .eq("month", month);
          } else {
            await supabase
              .from("monthly_stats")
              .insert({ year, month, revenue: amountEur, payments: 1 });
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error:", (err as Error).message);
    return json({ error: "Webhook handler failed" }, 500);
  }

  return json({ received: true });
});
