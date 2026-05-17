import { useSignIn } from "@clerk/clerk-expo";
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

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    if (!isLoaded || !signIn) return;
    setLoading(true);
    setError("");
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Sign in failed. Please try again.");
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "errors" in err
          ? (err as { errors: Array<{ message: string }> }).errors[0]?.message
          : "Sign in failed. Check your credentials.";
      setError(msg ?? "Sign in failed.");
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
          <Text style={[s.title, { color: colors.foreground }]}>FlowDeck</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Sign in to your account
          </Text>
        </View>

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
            autoComplete="password"
          />

          {error ? (
            <Text style={[s.error, { color: colors.destructive }]}>{error}</Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              s.button,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleSignIn}
            disabled={loading || !email || !password}
            testID="sign-in-button"
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[s.buttonText, { color: colors.primaryForeground }]}>Sign In</Text>
            )}
          </Pressable>
        </View>

        <View style={s.footer}>
          <Text style={[s.footerText, { color: colors.mutedForeground }]}>
            {"Don't have an account? "}
          </Text>
          <Link href="/sign-up" asChild>
            <Pressable>
              <Text style={[s.link, { color: colors.primary }]}>Sign up</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    container: {
      flex: 1,
      paddingHorizontal: 24,
      justifyContent: "center",
    },
    header: {
      alignItems: "center",
      marginBottom: 40,
    },
    logoBox: {
      width: 64,
      height: 64,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    logoText: {
      fontSize: 32,
      fontWeight: "700" as const,
      color: "#ffffff",
      fontFamily: "Inter_700Bold",
    },
    title: {
      fontSize: 28,
      fontWeight: "700" as const,
      fontFamily: "Inter_700Bold",
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      fontFamily: "Inter_400Regular",
    },
    form: {
      gap: 12,
      marginBottom: 32,
    },
    input: {
      height: 52,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 16,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
    },
    error: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
    },
    button: {
      height: 52,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    footerText: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
    },
    link: {
      fontSize: 15,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
  });
