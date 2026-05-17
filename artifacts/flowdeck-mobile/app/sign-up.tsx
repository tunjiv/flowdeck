import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Step = "form" | "verify";

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async () => {
    if (!isLoaded || !signUp) return;
    setLoading(true);
    setError("");
    try {
      const result = await signUp.create({
        emailAddress: email.trim(),
        password,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep("verify");
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "errors" in err
          ? (err as { errors: Array<{ message: string }> }).errors[0]?.message
          : "Sign up failed.";
      setError(msg ?? "Sign up failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !signUp) return;
    setLoading(true);
    setError("");
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "errors" in err
          ? (err as { errors: Array<{ message: string }> }).errors[0]?.message
          : "Invalid code.";
      setError(msg ?? "Invalid code.");
    } finally {
      setLoading(false);
    }
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[s.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]}>
        <View style={s.header}>
          <View style={[s.logoBox, { backgroundColor: colors.primary }]}>
            <Text style={s.logoText}>F</Text>
          </View>
          <Text style={[s.title, { color: colors.foreground }]}>Create account</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            {step === "form" ? "Get started with FlowDeck" : "Check your email for a code"}
          </Text>
        </View>

        {step === "form" ? (
          <View style={s.form}>
            <TextInput
              style={[s.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Email address"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Password"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            {error ? <Text style={[s.error, { color: colors.destructive }]}>{error}</Text> : null}
            <Pressable
              style={({ pressed }) => [s.button, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={handleSignUp}
              disabled={loading || !email || !password}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[s.buttonText, { color: colors.primaryForeground }]}>Create Account</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={s.form}>
            <Text style={[s.verifyHint, { color: colors.mutedForeground }]}>
              {"Enter the 6-digit code sent to "}
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>{email}</Text>
            </Text>
            <TextInput
              style={[s.input, s.codeInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="000000"
              placeholderTextColor={colors.mutedForeground}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            {error ? <Text style={[s.error, { color: colors.destructive }]}>{error}</Text> : null}
            <Pressable
              style={({ pressed }) => [s.button, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={handleVerify}
              disabled={loading || code.length < 6}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[s.buttonText, { color: colors.primaryForeground }]}>Verify Email</Text>
              )}
            </Pressable>
            <Pressable onPress={() => { setStep("form"); setError(""); }}>
              <Text style={[s.back, { color: colors.mutedForeground }]}>Back</Text>
            </Pressable>
          </View>
        )}

        {step === "form" && (
          <View style={s.footer}>
            <Text style={[s.footerText, { color: colors.mutedForeground }]}>Already have an account? </Text>
            <Link href="/sign-in" asChild>
              <Pressable>
                <Text style={[s.link, { color: colors.primary }]}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    container: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
    header: { alignItems: "center", marginBottom: 40 },
    logoBox: { width: 64, height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 16 },
    logoText: { fontSize: 32, fontWeight: "700" as const, color: "#ffffff", fontFamily: "Inter_700Bold" },
    title: { fontSize: 28, fontWeight: "700" as const, fontFamily: "Inter_700Bold", marginBottom: 8 },
    subtitle: { fontSize: 16, fontFamily: "Inter_400Regular", textAlign: "center" },
    form: { gap: 12, marginBottom: 32 },
    input: { height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, fontFamily: "Inter_400Regular" },
    codeInput: { textAlign: "center", fontSize: 24, letterSpacing: 8, fontFamily: "Inter_700Bold" },
    verifyHint: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
    error: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
    button: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 4 },
    buttonText: { fontSize: 16, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    back: { textAlign: "center", fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 8 },
    footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
    footerText: { fontSize: 15, fontFamily: "Inter_400Regular" },
    link: { fontSize: 15, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  });
