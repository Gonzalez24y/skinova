import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSignIn, useSignUp, useSSO } from "@clerk/expo";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

type Mode = "signin" | "signup" | "verify";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = useCallback(async () => {
    if (!signInLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: "skinova://login",
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/");
      }
    } catch (e: any) {
      setError(e.errors?.[0]?.message || "Google 로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [signInLoaded, startSSOFlow]);

  const handleEmailSignIn = useCallback(async () => {
    if (!signIn || !signInLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setSignInActive({ session: result.createdSessionId });
        router.replace("/");
      }
    } catch (e: any) {
      setError(e.errors?.[0]?.longMessage || e.errors?.[0]?.message || "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [signIn, signInLoaded, email, password, setSignInActive]);

  const handleEmailSignUp = useCallback(async () => {
    if (!signUp || !signUpLoaded) return;
    setLoading(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setMode("verify");
    } catch (e: any) {
      setError(e.errors?.[0]?.longMessage || e.errors?.[0]?.message || "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [signUp, signUpLoaded, email, password]);

  const handleVerify = useCallback(async () => {
    if (!signUp || !signUpLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setSignUpActive({ session: result.createdSessionId });
        router.replace("/");
      }
    } catch (e: any) {
      setError(e.errors?.[0]?.longMessage || "인증 코드가 올바르지 않습니다.");
    } finally {
      setLoading(false);
    }
  }, [signUp, signUpLoaded, code, setSignUpActive]);

  const s = styles(colors);
  const topInset = Platform.OS === "web" ? 60 : insets.top;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.cream }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: topInset + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.header}>
          <View style={[s.logoCircle, { backgroundColor: colors.terraLight }]}>
            <MaterialCommunityIcons name="face-recognition" size={40} color={colors.terra} />
          </View>
          <Text style={[s.title, { color: colors.foreground }]}>
            Skin<Text style={{ color: colors.terra }}>ova</Text>
          </Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>AI 피부 진단</Text>
        </View>

        {/* Error */}
        {error && (
          <View style={[s.errorBox, { backgroundColor: "#FFF0EF", borderColor: "#FFD0CC" }]}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* Verify mode */}
        {mode === "verify" ? (
          <View style={s.form}>
            <Text style={[s.formTitle, { color: colors.foreground }]}>이메일 인증</Text>
            <Text style={[s.formSubtitle, { color: colors.mutedForeground }]}>
              {email}로 전송된 6자리 코드를 입력하세요.
            </Text>
            <TextInput
              style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="인증 코드"
              placeholderTextColor={colors.mutedForeground}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: colors.terra }]}
              onPress={handleVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>인증 확인</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Google */}
            <TouchableOpacity
              style={[s.googleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleGoogleLogin}
              disabled={loading}
            >
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={[s.googleBtnText, { color: colors.foreground }]}>Google로 계속하기</Text>
            </TouchableOpacity>

            <View style={s.divider}>
              <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[s.dividerText, { color: colors.mutedForeground }]}>또는</Text>
              <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Email form */}
            <View style={s.form}>
              <TextInput
                style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="이메일"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="비밀번호"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {mode === "signin" ? (
                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: colors.terra }]}
                  onPress={handleEmailSignIn}
                  disabled={loading || !email || !password}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.primaryBtnText}>로그인</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: colors.terra }]}
                  onPress={handleEmailSignUp}
                  disabled={loading || !email || !password}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.primaryBtnText}>회원가입</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Toggle */}
            <TouchableOpacity
              style={s.toggleRow}
              onPress={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
            >
              <Text style={[s.toggleText, { color: colors.mutedForeground }]}>
                {mode === "signin" ? "계정이 없으신가요? " : "이미 계정이 있으신가요? "}
                <Text style={{ color: colors.terra, fontWeight: "700" }}>
                  {mode === "signin" ? "회원가입" : "로그인"}
                </Text>
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingBottom: 40,
      alignItems: "center",
    },
    header: { alignItems: "center", marginBottom: 32 },
    logoCircle: {
      width: 80, height: 80, borderRadius: 40,
      alignItems: "center", justifyContent: "center", marginBottom: 12,
    },
    title: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
    subtitle: { fontSize: 14, marginTop: 4 },
    errorBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      borderWidth: 1, borderRadius: 10, padding: 12,
      width: "100%", marginBottom: 16,
    },
    errorText: { color: "#EF4444", fontSize: 13, flex: 1 },
    googleBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 10, borderWidth: 1, borderRadius: 14, padding: 14,
      width: "100%", marginBottom: 16,
    },
    googleBtnText: { fontSize: 15, fontWeight: "600" },
    divider: {
      flexDirection: "row", alignItems: "center", gap: 12,
      width: "100%", marginBottom: 16,
    },
    dividerLine: { flex: 1, height: 1 },
    dividerText: { fontSize: 13 },
    form: { width: "100%", gap: 12 },
    formTitle: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
    formSubtitle: { fontSize: 14, marginBottom: 8 },
    input: {
      borderWidth: 1, borderRadius: 12, padding: 14,
      fontSize: 15, width: "100%",
    },
    primaryBtn: {
      borderRadius: 14, padding: 16,
      alignItems: "center", justifyContent: "center",
      width: "100%",
    },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    toggleRow: { marginTop: 20 },
    toggleText: { fontSize: 14, textAlign: "center" },
  });
