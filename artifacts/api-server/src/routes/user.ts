import { Router } from "express";
import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { storage } from "../storage";

const router = Router();

router.post("/sync", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return;
  }

  const email = (req.body?.email as string) || "";
  const user = await storage.upsertUser(userId, email);
  res.json(user);
});

router.get("/me", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return;
  }

  const user = await storage.getUser(userId);
  if (!user) {
    res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    return;
  }

  const subscription = await storage.getActiveSubscription(userId);
  res.json({
    ...user,
    hasActiveSubscription: !!subscription,
    subscription,
  });
});

router.post("/free-trial", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return;
  }

  const user = await storage.getUser(userId);
  if (!user) {
    res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    return;
  }

  await storage.claimFreeTrial(userId);
  res.json({ success: true, credits: 9999 });
});

export default router;
