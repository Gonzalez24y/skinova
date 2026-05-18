import Stripe from "stripe";

async function getStripeClient(): Promise<Stripe> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : null;

  if (hostname && xReplitToken) {
    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set("include_secrets", "true");
    url.searchParams.set("connector_names", "stripe");
    url.searchParams.set("environment", "development");
    const resp = await fetch(url.toString(), {
      headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
    });
    const data = await resp.json() as { items?: Array<{ settings?: { secret?: string } }> };
    const secretKey = data.items?.[0]?.settings?.secret;
    if (secretKey) return new Stripe(secretKey, { apiVersion: "2025-08-27.basil" as any });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe credentials not found");
  return new Stripe(secretKey, { apiVersion: "2025-08-27.basil" as any });
}

async function seedProducts() {
  console.log("Skinova 요금제 생성 중...");
  const stripe = await getStripeClient();

  // 1회 진단권
  const existingSingle = await stripe.products.search({
    query: "name:'1회 진단권' AND active:'true'",
  });

  if (existingSingle.data.length > 0) {
    console.log("1회 진단권 이미 존재:", existingSingle.data[0].id);
  } else {
    const single = await stripe.products.create({
      name: "1회 진단권",
      description: "AI 피부 진단 1회 이용권",
      metadata: { type: "one_time", credits: "1" },
    });
    const singlePrice = await stripe.prices.create({
      product: single.id,
      unit_amount: 1000,
      currency: "krw",
    });
    console.log(`✓ 1회 진단권 생성 완료 — price_id: ${singlePrice.id}`);
  }

  // 월간 무제한
  const existingMonthly = await stripe.products.search({
    query: "name:'월간 무제한 구독' AND active:'true'",
  });

  if (existingMonthly.data.length > 0) {
    console.log("월간 무제한 구독 이미 존재:", existingMonthly.data[0].id);
  } else {
    const monthly = await stripe.products.create({
      name: "월간 무제한 구독",
      description: "한 달간 AI 피부 진단 무제한 이용",
      metadata: { type: "subscription" },
    });
    const monthlyPrice = await stripe.prices.create({
      product: monthly.id,
      unit_amount: 10000,
      currency: "krw",
      recurring: { interval: "month" },
    });
    console.log(`✓ 월간 무제한 구독 생성 완료 — price_id: ${monthlyPrice.id}`);
  }

  console.log("완료! 웹훅이 DB에 자동 동기화됩니다.");
}

seedProducts().catch((e) => {
  console.error("오류:", e.message);
  process.exit(1);
});
