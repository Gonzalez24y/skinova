import { Router, type Request, type Response } from "express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";

const router = Router();

router.get("/config", (req: Request, res: Response) => {
  const host = getClerkProxyHost(req);
  const key = publishableKeyFromHost(
    host ?? "",
    process.env.CLERK_PUBLISHABLE_KEY,
  );
  res.json({ clerkPublishableKey: key || process.env.CLERK_PUBLISHABLE_KEY || "" });
});

export default router;
