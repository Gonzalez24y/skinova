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
} from "react-native";
import { useAuth, useUser } from "@clerk/expo";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { fetch } from "expo/fetch";
import { useColors } from "@/hooks/useColors";

interface Plan {
  product_id: string;
  name: string;
  description: string | null;
  price_id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
}

interface UserInfo {
  credits: number;
  hasActiveSubscription: boolean;
}

export default function PricingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken, userId } = useAuth();
  const { user } = useUser();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

  const syncUser = useCallback(async (token: string) => {
    await fetch(`${apiUrl}/api/user/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user?.primaryEmailAddress?.emailAddress || "" }),
    });
  }, [apiUrl, user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) { router.replace("/login"); return; }

      await syncUser(token);

      const [plansRes, meRes] = await Promise.all([
        fetch(`${apiUrl}/api/payment/plans`),
        fetch(`${apiUrl}/api/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json() as { plans: Plan[] };
        setPlans(plansData.plans || []);
      }
      if (meRes.ok) {
        const meData = await meRes.json() as UserInfo;
        setUserInfo(meData);
      }
    } catch (e) {
      setError("데이터를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getToken, syncUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePurchase = useCallback(async (plan: Plan) => {
    setPurchasing(plan.price_id);
    setError(null);
    try {
      const token = await getToken();
      if (!token) { router.replace("/login"); return; }

      const mode = plan.recurring ? "subscription" : "payment";
      const res = await fetch(`${apiUrl}/api/payment/checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: plan.price_id, mode }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "결제 세션 생성에 실패했습니다.");
      }

      if (Platform.OS === "web") {
        window.open(data.url, "_blank");
      } else {
        const result = await WebBrowser.openBrowserAsync(data.url);
        if (result.type === "dismiss") {
          await loadData();
        }
      }
    } catch (e: any) {
      setError(e.message || "결제 처리 중 오류가 발생했습니다.");
    } finally {
      setPurchasing(null);
    }
  }, [apiUrl, getToken, loadData]);

  const formatPrice = (amount: number, currency: string) => {
    if (currency === "krw") return `₩${amount.toLocaleString("ko-KR")}`;
    return `$${(amount / 100).toFixed(2)}`;
  };

  const topInset = Platform.OS === "web" ? 60 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  if (loading) {
    return (
      <View style={[{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.cream }]}>
        <ActivityIndicator size="large" color={colors.terra} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: topInset + 16, paddingBottom: bottomInset + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.terraLight }]}>
            <MaterialCommunityIcons name="crown" size={32} color={colors.terra} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>요금제 선택</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            AI 피부 진단을 이용하려면 요금제를 선택하세요
          </Text>
        </View>

        {/* Current status */}
        {userInfo && (
          <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="information-circle" size={18} color={colors.terra} />
            <Text style={[styles.statusText, { color: colors.foreground }]}>
              {userInfo.hasActiveSubscription
                ? "월간 무제한 구독 이용 중"
                : `잔여 진단 횟수: ${userInfo.credits}회`}
            </Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: "#FFF0EF", borderColor: "#FFD0CC" }]}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Plans */}
        {plans.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              요금제를 준비 중입니다. 잠시 후 다시 시도해주세요.
            </Text>
          </View>
        ) : (
          plans.map((plan) => {
            const isSubscription = !!plan.recurring;
            const isPopular = isSubscription;
            return (
              <View
                key={plan.price_id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: isPopular ? colors.terra : colors.card,
                    borderColor: isPopular ? colors.terra : colors.border,
                  },
                ]}
              >
                {isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>인기</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <Ionicons
                    name={isSubscription ? "infinite" : "flash"}
                    size={24}
                    color={isPopular ? "#fff" : colors.terra}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.planName, { color: isPopular ? "#fff" : colors.foreground }]}>
                      {plan.name}
                    </Text>
                    {plan.description && (
                      <Text style={[styles.planDesc, { color: isPopular ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>
                        {plan.description}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.planPriceRow}>
                  <Text style={[styles.planPrice, { color: isPopular ? "#fff" : colors.foreground }]}>
                    {formatPrice(plan.unit_amount, plan.currency)}
                  </Text>
                  {isSubscription && (
                    <Text style={[styles.planInterval, { color: isPopular ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
                      / 월
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.planBtn,
                    {
                      backgroundColor: isPopular ? "#fff" : colors.terra,
                    },
                  ]}
                  onPress={() => handlePurchase(plan)}
                  disabled={!!purchasing}
                >
                  {purchasing === plan.price_id ? (
                    <ActivityIndicator color={isPopular ? colors.terra : "#fff"} />
                  ) : (
                    <Text style={[styles.planBtnText, { color: isPopular ? colors.terra : "#fff" }]}>
                      {isSubscription ? "구독하기" : "구매하기"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
          결제는 Stripe를 통해 안전하게 처리됩니다.{"\n"}
          구독은 언제든지 취소 가능합니다.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20 },
  backBtn: { alignSelf: "flex-start", padding: 4, marginBottom: 16 },
  hero: { alignItems: "center", marginBottom: 28 },
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
  emptyCard: {
    borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center",
  },
  emptyText: { fontSize: 14, textAlign: "center" },
  planCard: {
    borderWidth: 1.5, borderRadius: 20, padding: 20,
    marginBottom: 16, position: "relative",
  },
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
  planBtn: {
    borderRadius: 12, padding: 14,
    alignItems: "center", justifyContent: "center",
  },
  planBtnText: { fontSize: 15, fontWeight: "700" },
  disclaimer: { fontSize: 12, textAlign: "center", marginTop: 16, lineHeight: 18 },
});
