import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

// Set the API base URL at module load time (outside of any component)
const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) {
  setBaseUrl(`https://${domain}`);
}

// Platform-safe token cache: localStorage on web, SecureStore on native
const tokenCache =
  Platform.OS === "web"
    ? {
        async getToken(key: string) {
          return typeof window !== "undefined"
            ? window.localStorage.getItem(key)
            : null;
        },
        async saveToken(key: string, value: string) {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(key, value);
          }
        },
        async clearToken(key: string) {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(key);
          }
        },
      }
    : {
        async getToken(key: string) {
          return SecureStore.getItemAsync(key);
        },
        async saveToken(key: string, value: string) {
          return SecureStore.setItemAsync(key, value);
        },
        async clearToken(key: string) {
          return SecureStore.deleteItemAsync(key);
        },
      };

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Syncs the Clerk session token into the API client
function ClerkAuthSync() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => {
      setAuthTokenGetter(null);
    };
  }, [getToken]);
  return null;
}

// Always render the Stack so Redirect works within the navigator
function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ headerShown: false }} />
      <Stack.Screen
        name="goal/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <ClerkAuthSync />
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
