import { useAuth } from "@clerk/clerk-expo";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Redirect, Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const colors = useColors();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  return <>{children}</>;
}

function NativeTabLayout() {
  return (
    <AuthGuard>
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <Icon sf={{ default: "house", selected: "house.fill" }} />
          <Label>Today</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="goals">
          <Icon sf={{ default: "target", selected: "target" }} />
          <Label>Goals</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="tasks">
          <Icon sf={{ default: "checklist", selected: "checklist" }} />
          <Label>Tasks</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="habits">
          <Icon sf={{ default: "repeat", selected: "repeat" }} />
          <Label>Habits</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="focus">
          <Icon sf={{ default: "timer", selected: "clock.fill" }} />
          <Label>Focus</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </AuthGuard>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const safeAreaInsets = useSafeAreaInsets();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <AuthGuard>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: isIOS ? "transparent" : colors.background,
            borderTopWidth: isWeb ? 1 : 0,
            borderTopColor: colors.border,
            elevation: 0,
            paddingBottom: safeAreaInsets.bottom,
            ...(isWeb ? { height: 84 } : {}),
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : isWeb ? (
              <View
                style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
              />
            ) : null,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Today",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="house" tintColor={color} size={24} />
              ) : (
                <Feather name="home" size={22} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="goals"
          options={{
            title: "Goals",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="target" tintColor={color} size={24} />
              ) : (
                <Feather name="target" size={22} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: "Tasks",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="checklist" tintColor={color} size={24} />
              ) : (
                <Feather name="check-square" size={22} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="habits"
          options={{
            title: "Habits",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="repeat" tintColor={color} size={24} />
              ) : (
                <Feather name="repeat" size={22} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="focus"
          options={{
            title: "Focus",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="timer" tintColor={color} size={24} />
              ) : (
                <Feather name="clock" size={22} color={color} />
              ),
          }}
        />
      </Tabs>
    </AuthGuard>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
