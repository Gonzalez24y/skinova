import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  useGetPaymentPlans,
  useRequestPayment,
  useConfirmPayment,
  useClaimFreeTrial,
  useGetMe,
  getGetMeQueryKey,
  getGetPaymentPlansQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { Loader2, CheckCircle2, Copy, Gift, Zap, Infinity, Building2, ChevronLeft } from "lucide-react";

type Screen = "plans" | "transfer" | "success";

interface SelectedPlanInfo {
  requestId: string;
  planName: string;
  amount: number;
}

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useGetMe({
    query: { enabled: !!isSignedIn, queryKey: getGetMeQueryKey() },
  });
  const { data: plansData, isLoading: plansLoading } = useGetPaymentPlans({
    query: { queryKey: getGetPaymentPlansQueryKey() },
  });

  const requestPayment = useRequestPayment();
  const confirmPayment = useConfirmPayment();
  const claimFreeTrial = useClaimFreeTrial();

  const [screen, setScreen] = useState<Screen>("plans");
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlanInfo | null>(null);
  const [trialClaimed, setTrialClaimed] = useState(false);

  const handleClaimTrial = () => {
    if (!isSignedIn) { setLocation("/login"); return; }
    claimFreeTrial.mutate(undefined, {
      onSuccess: () => {
        setTrialClaimed(true);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "무료 체험 시작", description: "크레딧이 지급되었습니다." });
      },
      onError: () => {
        toast({ variant: "destructive", title: "오류", description: "무료 체험을 신청할 수 없습니다." });
      },
    });
  };

  const handleSelectPlan = (planId: string, planName: string, amount: number) => {
    if (!isSignedIn) { setLocation("/login"); return; }
    requestPayment.mutate(
      { data: { planType: planId as "single" | "monthly" } },
      {
        onSuccess: (data) => {
          setSelectedPlan({ requestId: data.request.id, planName, amount });
          setScreen("transfer");
        },
        onError: () => {
          toast({ variant: "destructive", title: "오류", description: "결제 요청 중 문제가 발생했습니다." });
        },
      }
    );
  };

  const handleConfirmDeposit = () => {
    if (!selectedPlan) return;
    confirmPayment.mutate(
      { requestId: selectedPlan.requestId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setScreen("success");
        },
        onError: () => {
          toast({ variant: "destructive", title: "오류", description: "입금 확인 요청 중 문제가 발생했습니다." });
        },
      }
    );
  };

  const copyAccount = () => {
    if (!plansData?.bank) return;
    navigator.clipboard.writeText(plansData.bank.account);
    toast({ title: "복사 완료", description: "계좌번호가 클립보드에 복사되었습니다." });
  };

  /* ── 입금 성공 화면 ── */
  if (screen === "success") {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-serif text-foreground">크레딧이 추가됐어요!</h2>
            <p className="text-muted-foreground">
              {selectedPlan?.planName} 이용권이 정상 적용되었습니다.<br />
              이제 AI 피부 진단을 이용해보세요.
            </p>
          </div>
          <Button size="lg" className="rounded-full px-8" onClick={() => setLocation("/")}>
            진단 시작하기
          </Button>
        </div>
      </Layout>
    );
  }

  /* ── 입금 안내 화면 ── */
  if (screen === "transfer" && selectedPlan && plansData?.bank) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-md">
          <button
            onClick={() => setScreen("plans")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
            data-testid="button-back-transfer"
          >
            <ChevronLeft size={16} />
            뒤로
          </button>

          <div className="text-center space-y-2 mb-8">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-serif text-foreground">입금 안내</h2>
            <p className="text-muted-foreground text-sm">아래 계좌로 입금 후 확인 버튼을 눌러주세요</p>
          </div>

          {/* 금액 */}
          <div className="rounded-2xl bg-primary text-primary-foreground p-6 text-center mb-4">
            <p className="text-primary-foreground/70 text-sm mb-1">입금 금액</p>
            <p className="text-4xl font-bold">₩{selectedPlan.amount.toLocaleString("ko-KR")}</p>
            <p className="text-primary-foreground/80 text-sm mt-1">{selectedPlan.planName}</p>
          </div>

          {/* 계좌 정보 */}
          <Card className="mb-4">
            <CardContent className="p-0 divide-y">
              <div className="flex justify-between items-center px-5 py-3.5">
                <span className="text-sm text-muted-foreground">은행</span>
                <span className="font-medium text-foreground">{plansData.bank.bank}</span>
              </div>
              <div className="flex justify-between items-center px-5 py-3.5">
                <span className="text-sm text-muted-foreground">계좌번호</span>
                <button
                  onClick={copyAccount}
                  className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors"
                  data-testid="button-copy-account"
                >
                  {plansData.bank.account}
                  <Copy size={14} className="text-primary" />
                </button>
              </div>
              <div className="flex justify-between items-center px-5 py-3.5">
                <span className="text-sm text-muted-foreground">예금주</span>
                <span className="font-medium text-foreground">{plansData.bank.holder}</span>
              </div>
            </CardContent>
          </Card>

          {/* 안내 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-6 text-sm text-amber-800">
            <span className="shrink-0 mt-0.5">ⓘ</span>
            <p>입금 완료 후 아래 버튼을 눌러 크레딧을 받으세요. 예금주명을 정확히 확인해주세요.</p>
          </div>

          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full h-14 text-base bg-green-600 hover:bg-green-700 rounded-xl gap-2"
              onClick={handleConfirmDeposit}
              disabled={confirmPayment.isPending}
              data-testid="button-confirm-deposit"
            >
              {confirmPayment.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CheckCircle2 size={18} />
              }
              입금 완료했어요
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl"
              onClick={() => setScreen("plans")}
            >
              취소
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  /* ── 요금제 목록 화면 ── */
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-lg">

        {/* 헤더 */}
        <div className="text-center space-y-2 mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-serif text-foreground">요금제 선택</h1>
          <p className="text-muted-foreground text-sm">계좌이체로 간편하게 이용권을 구매하세요</p>
        </div>

        {/* 현재 크레딧 상태 */}
        {user && (
          <div className="flex items-center gap-2 border rounded-xl px-4 py-3 mb-5 bg-card">
            <CheckCircle2 size={16} className="text-primary shrink-0" />
            <span className="text-sm font-medium text-foreground">
              {user.credits >= 9999
                ? "무제한 이용권 보유 중"
                : `잔여 진단 횟수: ${user.credits}회`}
            </span>
          </div>
        )}

        {/* 은행 정보 미리보기 */}
        {plansData?.bank && (
          <div className="flex items-center gap-2 border border-blue-200 bg-blue-50 rounded-xl px-4 py-3 mb-5 text-sm text-blue-700">
            <Building2 size={15} className="shrink-0" />
            <span className="font-medium">
              {plansData.bank.bank} &nbsp;{plansData.bank.account}&nbsp; ({plansData.bank.holder})
            </span>
          </div>
        )}

        {/* 무료 체험 */}
        {!user?.hasActiveSubscription && (
          <div className="border-2 border-green-200 bg-green-50 rounded-2xl p-5 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <Gift className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-green-800">무료 체험하기</p>
                <p className="text-sm text-green-600 mt-0.5">3번 한정 무료 체험 · 지금 바로 시작하세요</p>
              </div>
            </div>
            {trialClaimed ? (
              <div className="w-full py-3 rounded-xl bg-green-200 text-green-800 font-semibold text-sm text-center flex items-center justify-center gap-2">
                <CheckCircle2 size={16} />
                적용 완료!
              </div>
            ) : (
              <Button
                className="w-full bg-green-600 hover:bg-green-700 rounded-xl"
                onClick={handleClaimTrial}
                disabled={claimFreeTrial.isPending}
                data-testid="button-claim-trial"
              >
                {claimFreeTrial.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                무료 체험 시작
              </Button>
            )}
          </div>
        )}

        {/* 구분선 */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">계좌이체 구매</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* 요금제 카드 */}
        {plansLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {plansData?.plans.map((plan) => {
              const isPopular = plan.id === "monthly";
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border-2 p-5 ${
                    isPopular
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-card border-border text-foreground"
                  }`}
                  data-testid={`card-plan-${plan.id}`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 right-4 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      인기
                    </span>
                  )}
                  <div className="flex items-start gap-3 mb-3">
                    {isPopular
                      ? <Infinity className="w-6 h-6 text-primary-foreground/80 shrink-0" />
                      : <Zap className="w-6 h-6 text-primary shrink-0" />
                    }
                    <div>
                      <p className={`font-bold text-lg ${isPopular ? "text-primary-foreground" : "text-foreground"}`}>
                        {plan.name}
                      </p>
                      <p className={`text-sm ${isPopular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {plan.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className={`text-4xl font-extrabold ${isPopular ? "text-primary-foreground" : "text-foreground"}`}>
                      ₩{plan.amount.toLocaleString("ko-KR")}
                    </span>
                    {plan.id === "monthly" && (
                      <span className={`text-sm ${isPopular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        / 월
                      </span>
                    )}
                  </div>
                  <Button
                    className={`w-full rounded-xl font-bold ${
                      isPopular
                        ? "bg-white text-primary hover:bg-white/90"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                    onClick={() => handleSelectPlan(plan.id, plan.name, plan.amount)}
                    disabled={requestPayment.isPending}
                    data-testid={`button-select-plan-${plan.id}`}
                  >
                    {requestPayment.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    계좌이체로 구매
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground mt-6 leading-relaxed">
          입금 확인 후 즉시 크레딧이 지급됩니다.<br />
          문의: skinova@test.com
        </p>
      </div>
    </Layout>
  );
}
