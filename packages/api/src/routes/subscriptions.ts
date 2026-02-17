import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { subscriptions, users, TIERS } from "@volleycoach/shared";
import type { TierKey, ApiResponse } from "@volleycoach/shared";
import { requireAuth } from "../middleware/auth.js";
import { stripe, STRIPE_PRICE_IDS, STRIPE_WEBHOOK_SECRET } from "../lib/stripe.js";

const router = Router();

/**
 * GET /api/subscriptions/plans
 * List available subscription plans with pricing.
 */
router.get("/api/subscriptions/plans", (_req: Request, res: Response) => {
  const plans = Object.entries(TIERS).map(([key, config]) => ({
    id: key,
    name: config.name,
    price: config.price,
    priceFormatted:
      config.price === 0
        ? "Free"
        : `$${(config.price / 100).toFixed(2)}/mo`,
    features: {
      maxFollowedTeams:
        config.maxFollowedTeams === -1
          ? "Unlimited"
          : config.maxFollowedTeams,
      canCreateClub: config.canCreateClub,
      canManageRosters: config.canManageRosters,
      canScoreGames: config.canScoreGames,
      canStream: config.canStream,
      canUseAICoach: config.canUseAICoach,
      aiAnalysesPerMonth:
        config.aiAnalysesPerMonth === -1
          ? "Unlimited"
          : config.aiAnalysesPerMonth,
      maxTeamsManaged:
        config.maxTeamsManaged === -1
          ? "Unlimited"
          : config.maxTeamsManaged,
      calendarReminders: config.calendarReminders,
      adFree: config.adFree,
      rsvpTracking: config.rsvpTracking,
      advancedAnalytics: config.advancedAnalytics,
      tournamentManagement: config.tournamentManagement,
      customBranding: config.customBranding,
      apiAccess: config.apiAccess,
      prioritySupport: config.prioritySupport,
    },
  }));

  res.json({
    success: true,
    data: plans,
  } satisfies ApiResponse);
});

/**
 * POST /api/subscriptions/checkout
 * Create a Stripe checkout session for a subscription plan.
 */
router.post(
  "/api/subscriptions/checkout",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { plan } = req.body;

      if (!plan || !["starter", "pro", "club"].includes(plan)) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "plan must be 'starter', 'pro', or 'club'.",
          },
        } satisfies ApiResponse);
        return;
      }

      const priceId = STRIPE_PRICE_IDS[plan];
      if (!priceId) {
        res.status(500).json({
          success: false,
          error: {
            code: "CONFIGURATION_ERROR",
            message: `Stripe price ID not configured for the ${plan} plan.`,
          },
        } satisfies ApiResponse);
        return;
      }

      // Get or create Stripe customer
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      let stripeCustomerId = sub?.stripeCustomerId;

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.fullName,
          metadata: {
            userId: user.id,
            firebaseUid: user.firebaseUid,
          },
        });
        stripeCustomerId = customer.id;

        if (sub) {
          await db
            .update(subscriptions)
            .set({ stripeCustomerId })
            .where(eq(subscriptions.id, sub.id));
        }
      }

      // Create checkout session
      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${appUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/subscribe?canceled=true`,
        metadata: {
          userId: user.id,
          plan,
        },
      });

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          url: session.url,
        },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Subscriptions] Error creating checkout:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create checkout session.",
        },
      } satisfies ApiResponse);
    }
  }
);

/**
 * POST /api/subscriptions/webhook
 * Stripe webhook handler. Processes subscription lifecycle events.
 */
router.post(
  "/api/subscriptions/webhook",
  async (req: Request, res: Response) => {
    try {
      const sig = req.headers["stripe-signature"] as string;

      let event;
      if (STRIPE_WEBHOOK_SECRET) {
        try {
          event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            STRIPE_WEBHOOK_SECRET
          );
        } catch (webhookErr) {
          console.error("[Stripe Webhook] Signature verification failed:", webhookErr);
          res.status(400).json({
            success: false,
            error: {
              code: "WEBHOOK_ERROR",
              message: "Invalid webhook signature.",
            },
          } satisfies ApiResponse);
          return;
        }
      } else {
        // In development without webhook secret, parse the event directly
        event = req.body;
      }

      const eventType = event.type;
      const data = event.data?.object;

      switch (eventType) {
        case "checkout.session.completed": {
          const userId = data.metadata?.userId;
          const plan = data.metadata?.plan as TierKey;
          const stripeSubscriptionId = data.subscription;
          const stripeCustomerId = data.customer;

          if (userId && plan) {
            const tierConfig = TIERS[plan];
            const aiLimit = tierConfig.aiAnalysesPerMonth === -1
              ? 999999
              : tierConfig.aiAnalysesPerMonth;

            // Retrieve the Stripe subscription for period info
            let currentPeriodEnd: Date | null = null;
            if (stripeSubscriptionId) {
              const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
              currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
            }

            await db
              .update(subscriptions)
              .set({
                tier: plan,
                status: "active",
                stripeSubscriptionId: stripeSubscriptionId ?? null,
                stripeCustomerId: stripeCustomerId ?? null,
                currentPeriodEnd,
                aiAnalysesUsed: 0,
                aiAnalysesLimit: aiLimit,
                cancelAtPeriodEnd: false,
              })
              .where(eq(subscriptions.userId, userId));

            console.log(
              `[Stripe] Subscription activated: ${userId} -> ${plan}`
            );
          }
          break;
        }

        case "customer.subscription.updated": {
          const stripeSubId = data.id;
          const status = data.status;
          const cancelAtPeriodEnd = data.cancel_at_period_end;
          const currentPeriodEnd = data.current_period_end;

          const [sub] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.stripeSubscriptionId, stripeSubId))
            .limit(1);

          if (sub) {
            const updateData: Record<string, unknown> = {
              cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
            };

            if (status === "active") updateData.status = "active";
            else if (status === "past_due") updateData.status = "past_due";
            else if (status === "canceled") updateData.status = "canceled";
            else if (status === "trialing") updateData.status = "trialing";

            if (currentPeriodEnd) {
              updateData.currentPeriodEnd = new Date(
                currentPeriodEnd * 1000
              );
            }

            await db
              .update(subscriptions)
              .set(updateData)
              .where(eq(subscriptions.id, sub.id));

            console.log(
              `[Stripe] Subscription updated: ${sub.userId} status=${status}`
            );
          }
          break;
        }

        case "customer.subscription.deleted": {
          const stripeSubId = data.id;

          const [sub] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.stripeSubscriptionId, stripeSubId))
            .limit(1);

          if (sub) {
            await db
              .update(subscriptions)
              .set({
                tier: "free",
                status: "canceled",
                stripeSubscriptionId: null,
                aiAnalysesUsed: 0,
                aiAnalysesLimit: 0,
                cancelAtPeriodEnd: false,
              })
              .where(eq(subscriptions.id, sub.id));

            console.log(
              `[Stripe] Subscription canceled: ${sub.userId} -> free`
            );
          }
          break;
        }

        case "invoice.payment_failed": {
          const customerId = data.customer;

          const [sub] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.stripeCustomerId, customerId))
            .limit(1);

          if (sub) {
            await db
              .update(subscriptions)
              .set({ status: "past_due" })
              .where(eq(subscriptions.id, sub.id));

            console.log(
              `[Stripe] Payment failed for user: ${sub.userId}`
            );
          }
          break;
        }

        default:
          console.log(`[Stripe] Unhandled event type: ${eventType}`);
      }

      res.json({ success: true, received: true } satisfies ApiResponse);
    } catch (err) {
      console.error("[Stripe Webhook] Error:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "WEBHOOK_ERROR",
          message: "Failed to process Stripe webhook.",
        },
      } satisfies ApiResponse);
    }
  }
);

/**
 * GET /api/subscriptions/portal
 * Get a Stripe billing portal URL for the authenticated user.
 */
router.get(
  "/api/subscriptions/portal",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;

      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (!sub?.stripeCustomerId) {
        res.status(400).json({
          success: false,
          error: {
            code: "NO_CUSTOMER",
            message:
              "No billing customer found. You need an active subscription first.",
          },
        } satisfies ApiResponse);
        return;
      }

      const appUrl = process.env.APP_URL || "http://localhost:3000";
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${appUrl}/settings`,
      });

      res.json({
        success: true,
        data: { url: session.url },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Subscriptions] Error creating portal session:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create billing portal session.",
        },
      } satisfies ApiResponse);
    }
  }
);

/**
 * PUT /api/subscriptions/cancel
 * Cancel the current subscription at the end of the billing period.
 */
router.put(
  "/api/subscriptions/cancel",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;

      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (!sub) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "No subscription found.",
          },
        } satisfies ApiResponse);
        return;
      }

      if (sub.tier === "free") {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_STATE",
            message: "Cannot cancel a free subscription.",
          },
        } satisfies ApiResponse);
        return;
      }

      if (!sub.stripeSubscriptionId) {
        res.status(400).json({
          success: false,
          error: {
            code: "NO_STRIPE_SUBSCRIPTION",
            message: "No Stripe subscription found to cancel.",
          },
        } satisfies ApiResponse);
        return;
      }

      // Cancel at period end via Stripe
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update local record
      await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: true })
        .where(eq(subscriptions.id, sub.id));

      res.json({
        success: true,
        data: {
          message:
            "Subscription will be canceled at the end of the current billing period.",
          cancelAtPeriodEnd: true,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        },
      } satisfies ApiResponse);
    } catch (err) {
      console.error("[Subscriptions] Error canceling subscription:", err);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to cancel subscription.",
        },
      } satisfies ApiResponse);
    }
  }
);

export default router;
