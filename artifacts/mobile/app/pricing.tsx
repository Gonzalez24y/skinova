import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  Clipboard,
} from "react-native";
import { useAuth, useUser } from "@clerk/expo";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { fetch } from "expo/fetch";
import { useColors } from "@/hooks/useColors";

interface Plan {
  id: string;
  name: string;
  description: string;
  amount: number;
  credits: number;
  recurring: { interval: string } | null;
}

interface BankInfo {
  bank: string;
  account: string;
  holder: string;
}

interface UserInfo {
  credits: number;
  hasActiveSubscription: boolean;
}

interface PaymentRequest {
  id: string;
  plan_type: string;
  amount: number;
  status: string;
}

type Screen = "plans" | "transfer" | "success";

export default function PricingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { user } = useUser();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [claimingTrial, setClaimingTrial] = useState(false);
  const [trialClaimed, setTrialClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [screen, setScreen] = useState<Screen>("plans");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);

  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) { router.replace("/login"); return; }

      await fetch(`${apiUrl}/api/user/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.primaryEmailAddress?.emailAddress || "" }),
      });

      const [plansRes, meRes] = await Promise.all([
        fetch(`${apiUrl}/api/payment/plans`),
        fetch(`${apiUrl}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (plansRes.ok) {
        const data = await plansRes.json() as { plans: Plan[]; bank: BankInfo };
        setPlans(data.plans || []);
        setBankInfo(data.bank || null);
      }
      if (meRes.ok) {
        setUserInfo(await meRes.json() as UserInfo);
      }
    } catch {
      setError("데이터를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getToken, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectPlan = useCallback(async (plan: Plan) => {
    setRequesting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) { router.replace("/login"); return; }

      const res = await fetch(`${apiUrl}/api/payment/request`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ planType: plan.id }),
      });
      const data = await res.json() as { request?: PaymentRequest; error?: string };
      if (!res.ok || !data.request) throw new Error(data.error || "요청 생성 실패");

      setSelectedPlan(plan);
      setPaymentRequest(data.request);
      setScreen("transfer");
    } catch (e: any) {
      setError(e.message || "오류가 발생했습니다.");
    } finally {
      setRequesting(false);
    }
  }, [apiUrl, getToken]);

  const handleConfirm = useCallback(async () => {
    if (!paymentRequest) return;
    setConfirming(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) { router.replace("/login"); return; }

      const res = await fetch(`${apiUrl}/api/payment/confirm/${paymentRequest.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { success?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "확인 실패");

      setScreen("success");
      await loadData();
    } catch (e: any) {
      setError(e.message || "오류가 발생했습니다.");
    } finally {
      setConfirming(false);
    }
  }, [apiUrl, getToken, paymentRequest, loadData]);

  const handleFreeTrial = useCallback(async () => {
    setClaimingTrial(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) { router.replace("/login"); return; }

      const res = await fetch(`${apiUrl}/api/user/free-trial`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "무료 체험 적용 실패");

      setTrialClaimed(true);
      await loadData();
    } catch (e: any) {
      setError(e.message || "오류가 발생했습니다.");
    } finally {
      setClaimingTrial(false);
    }
  }, [apiUrl, getToken, loadData]);

  const copyAccount = () => {
    if (!bankInfo) return;
    Clipboard.setString(bankInfo.account);
    Alert.alert("복사 완료", "계좌번호가 클립보드에 복사되었습니다.");
  };

  const topInset = Platform.OS === "web" ? 60 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.cream }}>
        <ActivityIndicator size="large" color={colors.terra} />
      </View>
    );
  }

  /* ── 입금 성공 화면 ── */
  if (screen === "success") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <View style={[styles.successIcon, { backgroundColor: "#F0FFF4" }]}>
          <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>크레딧이 추가됐어요!</Text>
        <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
          {selectedPlan?.name} 이용권이 정상 적용되었습니다.{"\n"}
          이제 AI 피부 진단을 이용해보세요.
        </Text>
        <TouchableOpacity
          style={[styles.bigBtn, { backgroundColor: colors.terra, marginTop: 32 }]}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.bigBtnText}>진단 시작하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /* ── 입금 안내 화면 ── */
  if (screen === "transfer" && selectedPlan && paymentRequest && bankInfo) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: topInset + 16, paddingBottom: bottomInset + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => { setScreen("plans"); setError(null); }}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>

          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name="business" size={32} color="#2563EB" />
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>입금 안내</Text>
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
              아래 계좌로 입금 후 확인 버튼을 눌러주세요
            </Text>
          </View>

          {/* 금액 */}
          <View style={[styles.amountCard, { backgroundColor: colors.terra }]}>
            <Text style={styles.amountLabel}>입금 금액</Text>
            <Text style={styles.amountValue}>₩{selectedPlan.amount.toLocaleString("ko-KR")}</Text>
            <Text style={styles.amountPlan}>{selectedPlan.name}</Text>
          </View>

          {/* 계좌 정보 */}
          <View style={[styles.bankCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.bankRow}>
              <Text style={[styles.bankLabel, { color: colors.mutedForeground }]}>은행</Text>
              <Text style={[styles.bankValue, { color: colors.foreground }]}>{bankInfo.bank}</Text>
            </View>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <View style={styles.bankRow}>
              <Text style={[styles.bankLabel, { color: colors.mutedForeground }]}>계좌번호</Text>
              <TouchableOpacity style={styles.accountRow} onPress={copyAccount}>
                <Text style={[styles.bankValue, { color: colors.foreground }]}>{bankInfo.account}</Text>
                <Ionicons name="copy-outline" size={16} color={colors.terra} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <View style={styles.bankRow}>
              <Text style={[styles.bankLabel, { color: colors.mutedForeground }]}>예금주</Text>
              <Text style={[styles.bankValue, { color: colors.foreground }]}>{bankInfo.holder}</Text>
            </View>
          </View>

          <View style={[styles.noticeBox, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
            <Ionicons name="information-circle" size={16} color="#D97706" />
            <Text style={[styles.noticeText, { color: "#92400E" }]}>
              입금 시 예금주명을 정확히 확인해주세요.{"\n"}
              입금 완료 후 아래 버튼을 눌러 크레딧을 받으세요.
            </Text>
          </View>

          {error && (
            <View style={[styles.errorBox, { backgroundColor: "#FFF0EF", borderColor: "#FFD0CC" }]}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.bigBtn, { backgroundColor: "#16A34A", marginTop: 8 }]}
            onPress={handleConfirm}
            disabled={confirming}
          >
            {confirming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={[styles.bigBtnText, { marginLeft: 8 }]}>입금 완료했어요</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ghostBtn, { borderColor: colors.border }]}
            onPress={() => { setScreen("plans"); setError(null); }}
          >
            <Text style={[styles.ghostBtnText, { color: colors.mutedForeground }]}>취소</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  /* ── 요금제 목록 화면 ── */
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: topInset + 16, paddingBottom: bottomInset + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.terraLight }]}>
            <MaterialCommunityIcons name="crown" size={32} color={colors.terra} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>요금제 선택</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            계좌이체로 간편하게 이용권을 구매하세요
          </Text>
        </View>

        {/* 현재 상태 */}
        {userInfo && (
          <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="information-circle" size={18} color={colors.terra} />
            <Text style={[styles.statusText, { color: colors.foreground }]}>
              {userInfo.credits >= 9999
                ? "무제한 이용권 보유 중"
                : `잔여 진단 횟수: ${userInfo.credits}회`}
            </Text>
          </View>
        )}

        {/* 에러 */}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: "#FFF0EF", borderColor: "#FFD0CC" }]}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 무료 체험 */}
        {!userInfo?.hasActiveSubscription && (
          <View style={[styles.trialCard, { backgroundColor: "#F0FFF4", borderColor: "#86EFAC" }]}>
            <View style={styles.trialHeader}>
              <Ionicons name="gift" size={22} color="#16A34A" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.trialTitle, { color: "#15803D" }]}>무료 체험하기</Text>
                <Text style={[styles.trialDesc, { color: "#16A34A" }]}>
                  3번 한정 무료 체험 • 지금 바로 시작하세요
                </Text>
              </View>
            </View>
            {trialClaimed ? (
              <View style={[styles.planBtn, { backgroundColor: "#86EFAC", flexDirection: "row", gap: 6 }]}>
                <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                <Text style={[styles.planBtnText, { color: "#15803D" }]}>적용 완료!</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.planBtn, { backgroundColor: "#16A34A" }]}
                onPress={handleFreeTrial}
                disabled={claimingTrial}
              >
                {claimingTrial ? <ActivityIndicator color="#fff" /> : (
                  <Text style={[styles.planBtnText, { color: "#fff" }]}>무료 체험 시작</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 구분선 */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>계좌이체 구매</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* 계좌 미리보기 */}
        {bankInfo && (
          <View style={[styles.bankPreview, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
            <Ionicons name="business" size={16} color="#2563EB" />
            <Text style={[styles.bankPreviewText, { color: "#1D4ED8" }]}>
              {bankInfo.bank}  {bankInfo.account}  ({bankInfo.holder})
            </Text>
          </View>
        )}

        {/* 요금제 카드 */}
        {plans.map((plan) => {
          const isPopular = !!plan.recurring;
          return (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                { backgroundColor: isPopular ? colors.terra : colors.card, borderColor: isPopular ? colors.terra : colors.border },
              ]}
            >
              {isPopular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>인기</Text>
                </View>
              )}
              <View style={styles.planHeader}>
                <Ionicons
                  name={plan.recurring ? "infinite" : "flash"}
                  size={24}
                  color={isPopular ? "#fff" : colors.terra}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.planName, { color: isPopular ? "#fff" : colors.foreground }]}>{plan.name}</Text>
                  <Text style={[styles.planDesc, { color: isPopular ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>
                    {plan.description}
                  </Text>
                </View>
              </View>

              <View style={styles.planPriceRow}>
                <Text style={[styles.planPrice, { color: isPopular ? "#fff" : colors.foreground }]}>
                  ₩{plan.amount.toLocaleString("ko-KR")}
                </Text>
                {plan.recurring && (
                  <Text style={[styles.planInterval, { color: isPopular ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
                    / 월
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.planBtn, { backgroundColor: isPopular ? "#fff" : colors.terra }]}
                onPress={() => handleSelectPlan(plan)}
                disabled={requesting}
              >
                {requesting ? (
                  <ActivityIndicator color={isPopular ? colors.terra : "#fff"} />
                ) : (
                  <Text style={[styles.planBtnText, { color: isPopular ? colors.terra : "#fff" }]}>
                    계좌이체로 구매
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
          입금 확인 후 즉시 크레딧이 지급됩니다.{"\n"}
          문의: skinova@test.com
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20 },
  backBtn: { alignSelf: "flex-start", padding: 4, marginBottom: 16 },
  hero: { alignItems: "center", marginBottom: 24 },
  heroIcon: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  heroTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  heroSub: { fontSize: 14, textAlign: "center", marginTop: 6, lineHeight: 20 },
  statusCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16,
  },
  statusText: { fontSize: 14, fontWeight: "600" },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16,
  },
  errorText: { color: "#EF4444", fontSize: 13, flex: 1 },
  trialCard: { borderWidth: 1.5, borderRadius: 20, padding: 20, marginBottom: 16 },
  trialHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  trialTitle: { fontSize: 16, fontWeight: "700" },
  trialDesc: { fontSize: 13, marginTop: 2 },
  divider: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 8 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },
  bankPreview: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16,
  },
  bankPreviewText: { fontSize: 12, fontWeight: "600", flex: 1 },
  planCard: { borderWidth: 1.5, borderRadius: 20, padding: 20, marginBottom: 16, position: "relative" },
  popularBadge: {
    position: "absolute", top: -10, right: 16,
    backgroundColor: "#FF6B35", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3,
  },
  popularText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  planHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  planName: { fontSize: 17, fontWeight: "700" },
  planDesc: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  planPriceRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 16 },
  planPrice: { fontSize: 32, fontWeight: "800" },
  planInterval: { fontSize: 15, marginLeft: 4 },
  planBtn: { borderRadius: 12, padding: 14, alignItems: "center", justifyContent: "center" },
  planBtnText: { fontSize: 15, fontWeight: "700" },
  amountCard: { borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 16 },
  amountLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginBottom: 4 },
  amountValue: { color: "#fff", fontSize: 40, fontWeight: "800" },
  amountPlan: { color: "rgba(255,255,255,0.9)", fontSize: 14, marginTop: 4 },
  bankCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  bankRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  bankLabel: { fontSize: 13 },
  bankValue: { fontSize: 15, fontWeight: "600" },
  accountRow: { flexDirection: "row", alignItems: "center" },
  noticeBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16,
  },
  noticeText: { fontSize: 13, flex: 1, lineHeight: 20 },
  bigBtn: {
    borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  bigBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  ghostBtn: {
    borderWidth: 1, borderRadius: 16, padding: 16,
    alignItems: "center", justifyContent: "center",
  },
  ghostBtnText: { fontSize: 15, fontWeight: "600" },
  successIcon: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  successTitle: { fontSize: 24, fontWeight: "800", marginBottom: 12, textAlign: "center" },
  successSub: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  disclaimer: { fontSize: 12, textAlign: "center", marginTop: 16, lineHeight: 18 },
});
