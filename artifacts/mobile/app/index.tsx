import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { fetch } from "expo/fetch";
import { File } from "expo-file-system";
import { useAuth, useUser, useClerk } from "@clerk/expo";
import { router } from "expo-router";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface AnalysisResult {
  disease: string;
  severity: number;
  description: string;
  recommendations: string[];
  needsHospital: boolean;
  hospitalReason: string;
}

type Step = "landing" | "symptom" | "loading" | "result";

const SYMPTOMS = [
  { id: "acne", label: "여드름", icon: "water" as const },
  { id: "trouble", label: "트러블", icon: "flash" as const },
  { id: "dryness", label: "건조함", icon: "leaf" as const },
  { id: "other", label: "기타", icon: "chatbubble" as const },
] as const;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [step, setStep] = useState<Step>("landing");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

  // Sync user to DB when signed in
  useEffect(() => {
    if (isSignedIn && user) {
      getToken().then((token) => {
        if (!token) return;
        fetch(`${apiUrl}/api/user/sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.primaryEmailAddress?.emailAddress || "" }),
        }).catch(() => {});
      });
    }
  }, [isSignedIn, user]);

  const transitionTo = useCallback(
    (next: Step) => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setStep(next);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    },
    [fadeAnim]
  );

  const pickImage = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      const galleryStatus =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (galleryStatus.status !== "granted") {
        setError("카메라 또는 갤러리 접근 권한이 필요합니다.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });
      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setError(null);
        transitionTo("symptom");
      }
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setError(null);
      transitionTo("symptom");
    }
  }, [transitionTo]);

  const pickFromGallery = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("갤러리 접근 권한이 필요합니다.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setError(null);
      transitionTo("symptom");
    }
  }, [transitionTo]);

  const toggleSymptom = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const startAnalysis = useCallback(async () => {
    if (!imageUri) return;

    if (!isSignedIn) {
      router.push("/login");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    transitionTo("loading");

    try {
      const token = await getToken();
      const formData = new FormData();
      if (Platform.OS === "web") {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append("image", blob, "skin.jpg");
      } else {
        const file = new File(imageUri);
        formData.append("image", file as unknown as Blob, "skin.jpg");
      }

      const symptomStr = symptoms.join(", ");
      if (symptomStr) formData.append("symptom", symptomStr);

      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiUrl}/api/skin/analyze`, {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await res.json() as AnalysisResult | { error: string; code?: string };

      if (res.status === 402) {
        setError("진단 횟수가 부족합니다. 요금제를 구매해주세요.");
        transitionTo("landing");
        setTimeout(() => router.push("/pricing"), 500);
        return;
      }

      if (!res.ok) {
        throw new Error((data as { error: string }).error || "분석에 실패했습니다.");
      }

      setResult(data as AnalysisResult);
      setTimeout(() => transitionTo("result"), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
      transitionTo("landing");
    }
  }, [imageUri, symptoms, transitionTo, isSignedIn, getToken, apiUrl]);

  const handleReset = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImageUri(null);
    setSymptoms([]);
    setResult(null);
    setError(null);
    transitionTo("landing");
  }, [transitionTo]);

  const severityLabel = (level: number) =>
    ["", "매우 경미", "경미", "보통", "심각", "매우 심각"][level] || "";

  const severityColor = (level: number) =>
    ["", "#4CAF50", "#8BC34A", "#FFC107", "#FF9800", "#F44336"][level] ||
    "#ccc";

  const topInset = Platform.OS === "web" ? 80 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.cream }]}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        {/* LANDING */}
        {step === "landing" && (
          <View
            style={[
              styles.centered,
              { paddingTop: topInset + 20, paddingBottom: bottomInset + 20 },
            ]}
          >
            {/* User bar */}
            {isSignedIn ? (
              <View style={styles.userBar}>
                <Text style={[styles.userEmail, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {user?.primaryEmailAddress?.emailAddress || "로그인됨"}
                </Text>
                <View style={styles.userActions}>
                  <TouchableOpacity onPress={() => router.push("/pricing")} style={[styles.userChip, { backgroundColor: colors.terraLight }]}>
                    <MaterialCommunityIcons name="crown" size={13} color={colors.terra} />
                    <Text style={[styles.userChipText, { color: colors.terra }]}>요금제</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => signOut()} style={[styles.userChip, { backgroundColor: colors.muted }]}>
                    <Ionicons name="log-out-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.userChipText, { color: colors.mutedForeground }]}>로그아웃</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => router.push("/login")} style={[styles.loginBanner, { backgroundColor: colors.terraLight, borderColor: colors.terra }]}>
                <Ionicons name="person-circle-outline" size={18} color={colors.terra} />
                <Text style={[styles.loginBannerText, { color: colors.terra }]}>로그인 / 회원가입</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.terra} />
              </TouchableOpacity>
            )}

            <View style={styles.heroSection}>
              <View
                style={[
                  styles.logoCircle,
                  { backgroundColor: colors.terraLight },
                ]}
              >
                <MaterialCommunityIcons
                  name="face-recognition"
                  size={48}
                  color={colors.terra}
                />
              </View>
              <Text style={[styles.appTitle, { color: colors.foreground }]}>
                Skin
                <Text style={{ color: colors.terra }}>ova</Text>
              </Text>
              <Text style={[styles.appSubtitle, { color: colors.warmLight }]}>
                AI 피부 진단
              </Text>
            </View>

            {error && (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: "#FFF0EF", borderColor: "#FFD0CC" },
                ]}
              >
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.terra },
                ]}
                onPress={pickImage}
                activeOpacity={0.85}
              >
                <Ionicons name="camera" size={22} color="#fff" />
                <Text style={styles.primaryButtonText}>카메라로 촬영</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={pickFromGallery}
                activeOpacity={0.85}
              >
                <Ionicons name="image" size={22} color={colors.terra} />
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: colors.foreground },
                  ]}
                >
                  갤러리에서 선택
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
              AI 기반 피부 분석 · 전문의 진단 대체 불가
            </Text>
          </View>
        )}

        {/* SYMPTOM */}
        {step === "symptom" && (
          <View style={[styles.flex, { paddingTop: topInset }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => transitionTo("landing")}
                style={styles.backButton}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={colors.foreground}
                />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                증상 선택
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              contentContainerStyle={[
                styles.symptomContent,
                { paddingBottom: bottomInset + 100 },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {imageUri && (
                <View style={styles.previewContainer}>
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.previewImage}
                  />
                </View>
              )}

              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                신경 쓰이는 증상을{"\n"}골라주세요
              </Text>
              <Text
                style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}
              >
                여러 개 선택 가능
              </Text>

              <View style={styles.symptomGrid}>
                {SYMPTOMS.map((s) => {
                  const isSelected = symptoms.includes(s.id);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.symptomCard,
                        {
                          backgroundColor: isSelected
                            ? colors.terraLight
                            : colors.card,
                          borderColor: isSelected
                            ? colors.terra
                            : colors.border,
                        },
                      ]}
                      onPress={() => toggleSymptom(s.id)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.symptomIconBox,
                          {
                            backgroundColor: isSelected
                              ? colors.terra
                              : colors.muted,
                          },
                        ]}
                      >
                        <Ionicons
                          name={s.icon}
                          size={20}
                          color={isSelected ? "#fff" : colors.mutedForeground}
                        />
                      </View>
                      <Text
                        style={[
                          styles.symptomLabel,
                          {
                            color: isSelected
                              ? colors.terra
                              : colors.foreground,
                            fontWeight: isSelected ? "700" : "500",
                          },
                        ]}
                      >
                        {s.label}
                      </Text>
                      {isSelected && (
                        <View
                          style={[
                            styles.checkBadge,
                            { backgroundColor: colors.terra },
                          ]}
                        >
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View
              style={[
                styles.floatingBottom,
                {
                  paddingBottom: bottomInset + 16,
                  backgroundColor: colors.cream,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor:
                      symptoms.length > 0 ? colors.terra : colors.muted,
                  },
                ]}
                onPress={startAnalysis}
                disabled={symptoms.length === 0}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons
                  name="magnify-scan"
                  size={22}
                  color={symptoms.length > 0 ? "#fff" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.primaryButtonText,
                    {
                      color:
                        symptoms.length > 0 ? "#fff" : colors.mutedForeground,
                    },
                  ]}
                >
                  분석 시작
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setSymptoms([]);
                  startAnalysis();
                }}
                style={styles.skipButton}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.skipText, { color: colors.mutedForeground }]}
                >
                  증상 없이 바로 분석
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* LOADING */}
        {step === "loading" && (
          <View style={[styles.centered, { paddingTop: topInset }]}>
            <View style={styles.loadingContent}>
              {imageUri && (
                <View style={styles.loadingImageWrapper}>
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.loadingImage}
                  />
                  <View
                    style={[
                      styles.scanOverlay,
                      { borderColor: colors.terra },
                    ]}
                  />
                </View>
              )}
              <ActivityIndicator
                size="large"
                color={colors.terra}
                style={{ marginTop: 32 }}
              />
              <Text
                style={[styles.loadingTitle, { color: colors.foreground }]}
              >
                AI가 피부를 분석 중이에요
              </Text>
              <Text
                style={[
                  styles.loadingSubtitle,
                  { color: colors.mutedForeground },
                ]}
              >
                잠시만 기다려주세요
              </Text>
            </View>
          </View>
        )}

        {/* RESULT */}
        {step === "result" && result && (
          <ScrollView
            contentContainerStyle={[
              styles.resultContent,
              {
                paddingTop: topInset + 16,
                paddingBottom: bottomInset + 16,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.resultHeader, { color: colors.mutedForeground }]}>
              분석 결과
            </Text>

            {/* Disease Card */}
            <View
              style={[
                styles.resultCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.resultTopRow}>
                {imageUri && (
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.resultThumb}
                  />
                )}
                <View style={styles.resultTitleBlock}>
                  <Text
                    style={[
                      styles.resultLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    추정 상태
                  </Text>
                  <Text
                    style={[styles.resultDisease, { color: colors.foreground }]}
                  >
                    {result.disease}
                  </Text>
                </View>
              </View>
              <Text
                style={[styles.resultDescription, { color: colors.warmBrown }]}
              >
                {result.description}
              </Text>
            </View>

            {/* Severity */}
            {result.severity > 0 && (
              <View
                style={[
                  styles.resultCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.severityHeader}>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    심각도
                  </Text>
                  <Text
                    style={[
                      styles.severityValue,
                      { color: severityColor(result.severity) },
                    ]}
                  >
                    {result.severity}/5 · {severityLabel(result.severity)}
                  </Text>
                </View>
                <View style={styles.severityBars}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <View
                      key={level}
                      style={[
                        styles.severityBar,
                        {
                          backgroundColor:
                            level <= result.severity
                              ? severityColor(result.severity)
                              : colors.muted,
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Recommendations */}
            <View
              style={[
                styles.resultCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.cardTitleRow}>
                <Ionicons name="home" size={16} color={colors.terra} />
                <Text
                  style={[styles.cardTitle, { color: colors.mutedForeground }]}
                >
                  집에서 할 수 있는 관리
                </Text>
              </View>
              {result.recommendations.map((rec, i) => (
                <View key={i} style={styles.recRow}>
                  <View
                    style={[
                      styles.recNumber,
                      { backgroundColor: colors.terraLight },
                    ]}
                  >
                    <Text style={[styles.recNum, { color: colors.terra }]}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={[styles.recText, { color: colors.warmBrown }]}>
                    {rec}
                  </Text>
                </View>
              ))}
            </View>

            {/* Hospital */}
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: result.needsHospital ? "#FFF5F5" : "#F0FFF4",
                  borderColor: result.needsHospital ? "#FFC5C5" : "#B2F5CC",
                },
              ]}
            >
              <View style={styles.hospitalRow}>
                <Ionicons
                  name={result.needsHospital ? "medical" : "checkmark-circle"}
                  size={20}
                  color={result.needsHospital ? "#EF4444" : "#22C55E"}
                />
                <Text
                  style={[
                    styles.hospitalTitle,
                    {
                      color: result.needsHospital ? "#DC2626" : "#16A34A",
                    },
                  ]}
                >
                  {result.needsHospital
                    ? "병원 방문을 권장합니다"
                    : "자가 관리로 충분합니다"}
                </Text>
              </View>
              {result.needsHospital && result.hospitalReason && (
                <Text style={[styles.hospitalReason, { color: "#DC2626" }]}>
                  {result.hospitalReason}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.terra }]}
              onPress={handleReset}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>다시 진단하기</Text>
            </TouchableOpacity>

            <Text
              style={[styles.disclaimer, { color: colors.mutedForeground }]}
            >
              이 결과는 참고용이며 전문의 진단을 대체하지 않습니다.
            </Text>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  userBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  userEmail: { fontSize: 12, flex: 1, marginRight: 8 },
  userActions: { flexDirection: "row", gap: 6 },
  userChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  userChipText: { fontSize: 12, fontWeight: "600" },
  loginBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    width: "100%", marginBottom: 12,
  },
  loginBannerText: { flex: 1, fontSize: 14, fontWeight: "600" },
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  appSubtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  buttonGroup: {
    width: "100%",
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 20,
    gap: 10,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 10,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    width: "100%",
  },
  errorText: {
    fontSize: 13,
    color: "#EF4444",
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  disclaimer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  symptomContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  previewContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  previewImage: {
    width: 100,
    height: 120,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    lineHeight: 32,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
  symptomGrid: {
    gap: 12,
  },
  symptomCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 14,
  },
  symptomIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  symptomLabel: {
    fontSize: 16,
    flex: 1,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  loadingContent: {
    alignItems: "center",
  },
  loadingImageWrapper: {
    position: "relative",
  },
  loadingImage: {
    width: 160,
    height: 192,
    borderRadius: 24,
  },
  scanOverlay: {
    position: "absolute",
    inset: -4,
    borderRadius: 28,
    borderWidth: 2,
    opacity: 0.6,
  },
  loadingTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    marginTop: 20,
    textAlign: "center",
  },
  loadingSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  resultContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  resultHeader: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  resultCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  resultTopRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  resultThumb: {
    width: 64,
    height: 76,
    borderRadius: 12,
  },
  resultTitleBlock: {
    flex: 1,
  },
  resultLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  resultDisease: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
  },
  resultDescription: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  severityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  severityValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  severityBars: {
    flexDirection: "row",
    gap: 6,
  },
  severityBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  recRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  recNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  recNum: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  recText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  hospitalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hospitalTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  hospitalReason: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    paddingLeft: 30,
  },
});
