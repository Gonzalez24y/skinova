import { Router } from "express";
import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { storage } from "../storage";
import { query } from "../db";

const router = Router();

const PLANS = [
  {
    id: "single",
    name: "1회 진단권",
    description: "AI 피부 진단 1회 이용권",
    amount: 1000,
    credits: 1,
    recurring: null,
  },
  {
    id: "monthly",
    name: "월간 무제한 구독",
    description: "한 달간 AI 피부 진단 무제한 이용",
    amount: 10000,
    credits: 9999,
    recurring: { interval: "month" },
  },
] as const;

const BANK_INFO = {
  bank: "카카오뱅크",
  account: "3333-01-6789012",
  holder: "스키노바(테스트)",
};

router.get("/plans", (_req: Request, res: Response) => {
  res.json({ plans: PLANS, bank: BANK_INFO });
});

router.post("/request", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return;
  }

  const { planType } = req.body as { planType: "single" | "monthly" };
  const plan = PLANS.find((p) => p.id === planType);
  if (!plan) {
    res.status(400).json({ error: "올바른 요금제를 선택해주세요." });
    return;
  }

  const user = await storage.getUser(userId);
  if (!user) {
    res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    return;
  }

  const result = await query(
    "INSERT INTO payment_requests (user_id, plan_type, amount) VALUES ($1, $2, $3) RETURNING *",
    [userId, planType, plan.amount]
  );
  const request = result.rows[0] as { id: string; plan_type: string; amount: number; status: string; created_at: Date };

  res.json({
    request,
    bank: BANK_INFO,
    plan: { name: plan.name, amount: plan.amount },
    message: `${BANK_INFO.bank} ${BANK_INFO.account} (${BANK_INFO.holder})으로 ₩${plan.amount.toLocaleString("ko-KR")}을 입금해주세요.`,
  });
});

router.post("/confirm/:requestId", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return;
  }

  const { requestId } = req.params;

  const result = await query(
    "SELECT * FROM payment_requests WHERE id = $1 AND user_id = $2",
    [requestId, userId]
  );
  const request = result.rows[0] as { id: string; plan_type: string; amount: number; status: string } | undefined;

  if (!request) {
    res.status(404).json({ error: "결제 요청을 찾을 수 없습니다." });
    return;
  }
  if (request.status === "confirmed") {
    res.status(400).json({ error: "이미 확인된 결제입니다." });
    return;
  }

  const plan = PLANS.find((p) => p.id === request.plan_type);
  if (!plan) {
    res.status(400).json({ error: "요금제 정보를 찾을 수 없습니다." });
    return;
  }

  await query(
    "UPDATE payment_requests SET status = 'confirmed' WHERE id = $1",
    [requestId]
  );
  await storage.addCredits(userId, plan.credits);

  res.json({
    success: true,
    credits: plan.credits,
    message: plan.credits >= 9999 ? "월간 무제한 이용권이 활성화되었습니다!" : `${plan.credits}회 이용권이 추가되었습니다!`,
  });
});

router.get("/my-requests", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return;
  }

  const result = await query(
    "SELECT * FROM payment_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10",
    [userId]
  );
  res.json({ requests: result.rows });
});

export default router;
