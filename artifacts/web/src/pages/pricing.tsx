import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  useGetPaymentPlans, 
  useRequestPayment, 
  useConfirmPayment, 
  useClaimFreeTrial,
  useGetMe,
  getGetMeQueryKey,
  getGetPaymentPlansQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { Loader2, CheckCircle2, CreditCard, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Pricing() {
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: user } = useGetMe({ 
    query: { enabled: !!isSignedIn, queryKey: getGetMeQueryKey() } 
  });
  
  const { data: plansData, isLoading: plansLoading } = useGetPaymentPlans({
    query: { queryKey: getGetPaymentPlansQueryKey() }
  });
  
  const requestPayment = useRequestPayment();
  const confirmPayment = useConfirmPayment();
  const claimFreeTrial = useClaimFreeTrial();

  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

  const handleClaimTrial = () => {
    claimFreeTrial.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "무료 체험 시작",
          description: "크레딧이 지급되었습니다.",
        });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "오류",
          description: "무료 체험을 신청할 수 없습니다.",
        });
      }
    });
  };

  const handleSelectPlan = (planId: string) => {
    // API expects planType 'single' or 'monthly', map the plan ID if needed or just use id as planType if they match
    // Actually the mock returns ids like 'single', 'monthly'
    requestPayment.mutate({ data: { planType: planId as "single" | "monthly" } }, {
      onSuccess: (data) => {
        setCurrentRequestId(data.request.id);
        setIsDepositDialogOpen(true);
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "오류",
          description: "결제 요청 중 문제가 발생했습니다.",
        });
      }
    });
  };

  const handleConfirmDeposit = () => {
    if (!currentRequestId) return;
    
    confirmPayment.mutate({ requestId: currentRequestId }, {
      onSuccess: () => {
        toast({
          title: "입금 확인 요청 완료",
          description: "관리자가 확인 후 크레딧을 지급해드립니다.",
        });
        setIsDepositDialogOpen(false);
        setCurrentRequestId(null);
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "오류",
          description: "입금 확인 요청 중 문제가 발생했습니다.",
        });
      }
    });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <div className="text-center space-y-4 mb-16">
          <h1 className="text-4xl md:text-5xl font-serif text-foreground">합리적인 플랜</h1>
          <p className="text-lg text-muted-foreground">당신의 피부 관리를 위한 최적의 요금제를 선택하세요.</p>
        </div>

        {plansLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Trial Card */}
            <Card className="flex flex-col relative overflow-hidden border-border/50">
              <div className="absolute top-0 left-0 w-full h-1 bg-muted"></div>
              <CardHeader className="text-center pb-8 pt-8">
                <CardTitle className="text-2xl font-serif">스타터</CardTitle>
                <CardDescription className="mt-2">무료 체험</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">₩0</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-4">
                  <li className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                    <span>9999 크레딧 제공</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                    <span>모든 기본 기능 사용</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleClaimTrial}
                  disabled={claimFreeTrial.isPending || !isSignedIn}
                >
                  {claimFreeTrial.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  무료 체험 시작하기
                </Button>
              </CardFooter>
            </Card>

            {/* Plans from API */}
            {plansData?.plans.map((plan) => (
              <Card key={plan.id} className={`flex flex-col relative overflow-hidden ${plan.id === 'monthly' ? 'border-primary shadow-lg ring-1 ring-primary/10' : 'border-border/50'}`}>
                {plan.id === 'monthly' && (
                  <div className="absolute top-0 left-0 w-full bg-primary text-primary-foreground text-xs font-bold text-center py-1 tracking-wider uppercase">
                    가장 인기있는 플랜
                  </div>
                )}
                <CardHeader className={`text-center pb-8 ${plan.id === 'monthly' ? 'pt-10' : 'pt-8'}`}>
                  <CardTitle className="text-2xl font-serif">{plan.name}</CardTitle>
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">₩{plan.amount.toLocaleString()}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-4">
                    <li className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className={`w-5 h-5 ${plan.id === 'monthly' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>{plan.credits.toLocaleString()} 크레딧 제공</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className={`w-5 h-5 ${plan.id === 'monthly' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>정밀 AI 진단 리포트</span>
                    </li>
                    {plan.id === 'monthly' && (
                      <li className="flex items-center gap-3 text-sm font-medium">
                        <Sparkles className="w-5 h-5 text-primary" />
                        <span>피부과 전문의 추천 연계</span>
                      </li>
                    )}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant={plan.id === 'monthly' ? 'default' : 'outline'} 
                    className="w-full" 
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={requestPayment.isPending || !isSignedIn}
                  >
                    {requestPayment.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    선택하기
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDepositDialogOpen} onOpenChange={setIsDepositDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              무통장 입금 안내
            </DialogTitle>
            <DialogDescription>
              아래 계좌로 입금하신 후, 확인 버튼을 눌러주세요.
            </DialogDescription>
          </DialogHeader>
          
          {plansData?.bank && (
            <div className="bg-muted p-6 rounded-xl space-y-3 mt-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">은행</span>
                <span className="font-medium text-foreground">{plansData.bank.bank}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">계좌번호</span>
                <span className="font-medium text-foreground font-mono">{plansData.bank.account}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">예금주</span>
                <span className="font-medium text-foreground">{plansData.bank.holder}</span>
              </div>
            </div>
          )}

          <div className="text-sm text-muted-foreground text-center mt-4">
            입금 확인은 영업일 기준 1-2시간 내에 완료됩니다.
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsDepositDialogOpen(false)}>
              나중에 하기
            </Button>
            <Button onClick={handleConfirmDeposit} disabled={confirmPayment.isPending}>
              {confirmPayment.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              입금 완료했습니다
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
