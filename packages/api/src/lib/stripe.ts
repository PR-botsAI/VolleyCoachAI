import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn(
    "[Stripe] STRIPE_SECRET_KEY not set. Stripe operations will fail."
  );
}

export const stripe = new Stripe(stripeSecretKey || "sk_missing_key", {
  apiVersion: "2025-04-30.basil",
  typescript: true,
});

/**
 * Stripe price IDs for each subscription tier.
 * These should be set as environment variables in production.
 */
export const STRIPE_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || "",
  pro: process.env.STRIPE_PRICE_PRO || "",
  club: process.env.STRIPE_PRICE_CLUB || "",
};

/**
 * The webhook signing secret used to verify incoming Stripe webhooks.
 */
export const STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || "";
