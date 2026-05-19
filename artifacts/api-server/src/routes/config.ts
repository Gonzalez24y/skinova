import { Router, type Request, type Response } from "express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { getClerkProxyHost, CLERK_PROXY_PATH } from "../middlewares/clerkProxyMiddleware";

const router = Router();

router.get("/config", (req: Request, res: Response) => {
  const host = getClerkProxyHost(req);
  const rawKey = process.env.CLERK_PUBLISHABLE_KEY ?? "";
  const key = publishableKeyFromHost(host ?? "", rawKey) || rawKey;

  const isProduction = process.env.NODE_ENV === "production";
  const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
  const proxyUrl = isProduction && host
    ? `${protocol}://${host}${CLERK_PROXY_PATH}`
    : null;

  res.json({ clerkPublishableKey: key, proxyUrl });
});

export default router;
