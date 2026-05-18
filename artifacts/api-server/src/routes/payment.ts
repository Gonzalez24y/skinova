import { Router } from "express";
import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { getUncachableStripeClient, getStripePublishableKey } from "../stripeClient";
import { storage } from "../storage";
import { query } from "../db";

const router = Router();

router.get("/publishable-key", async (_req: Request, res: Response) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch {
    res.status(500).json({ error: "Stripe 설정을 가져올 수 없습니다." });
  }
});

router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const rows = await query(`
      SELECT
        p.id as product_id, p.name, p.description, p.metadata,
        pr.id as price_id, pr.unit_amount, pr.currency, pr.recurring, pr.active as price_active
      FROM stripe.products p
      JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY pr.unit_amount ASC
    `);
    res.json({ plans: rows.rows });
  } catch (e) {
    res.status(500).json({ error: "요금제를 불러올 수 없습니다." });
  }
});

router.post("/checkout", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return;
  }

  const { priceId, mode } = req.body as { priceId: string; mode: "payment" | "subscription" };
  if (!priceId) {
    res.status(400).json({ error: "priceId가 필요합니다." });
    return;
  }

  try {
    let user = await storage.getUser(userId);
    if (!user) {
      res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      return;
    }

    const stripe = await getUncachableStripeClient();

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await storage.updateStripeCustomer(userId, customerId);
    }

    const domains = process.env.REPLIT_DOMAINS?.split(",") || [];
    const baseUrl = domains[0] ? `https://${domains[0]}` : "http://localhost:8080";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: mode || "payment",
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel`,
      metadata: { userId, mode: mode || "payment" },
    });

    res.json({ url: session.url });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "결제 세션 생성 실패" });
  }
});

export default router;
