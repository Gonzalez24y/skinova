import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe init");
    return;
  }
  try {
    await runMigrations({ databaseUrl });
    const stripeSync = await getStripeSync();
    const domains = process.env.REPLIT_DOMAINS?.split(",") || [];
    const webhookBase = domains[0] ? `https://${domains[0]}` : null;
    if (webhookBase) {
      await stripeSync.findOrCreateManagedWebhook(`${webhookBase}/api/stripe/webhook`);
    }
    stripeSync.syncBackfill().catch((e) => logger.error({ err: e }, "Stripe backfill error"));
    logger.info("Stripe initialized");
  } catch (e) {
    logger.error({ err: e }, "Stripe init failed");
  }
}

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
