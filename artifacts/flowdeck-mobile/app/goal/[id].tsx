import {
  useGetGoal,
  useGetGoalProgress,
  useListTasks,
  useCompleteTask,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function GoalDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const goalId = parseInt(id ?? "0", 10);
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";

  const { data: goal, isLoading: loadingGoal } = useGetGoal(goalId);
  const { data: progress } = useGetGoalProgress(goalId);
  const { data: tasks } = useListTasks({ goalId });
  const completeTask = useCompleteTask();

  const handleComplete = async (taskId: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeTask.mutateAsync({ id: taskId });
    await queryClient.invalidateQueries({ queryKey: ["listTasks"] });
  };

  const topPad = isWeb ? 67 : insets.top;
  const s = styles(colors);

  if (loadingGoal || !goal) {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const progressPct =
    goal.goalType === "quantitative" && goal.targetValue && goal.targetValue > 0
      ? Math.min(1, (goal.currentValue ?? 0) / goal.targetValue)
      : null;

  const doneTasks = tasks?.filter((t) => t.status === "completed").length ?? 0;
  const totalTasks = tasks?.length ?? 0;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{goal.title}</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={tasks ?? []}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={!!(tasks && tasks.length > 0)}
        contentContainerStyle={[s.content, { paddingBottom: isWeb ? 34 : insets.bottom + 100 }]}
        ListHeaderComponent={() => (
          <>
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.cardTopRow}>
                <View style={[s.typeBadge, { backgroundColor: colors.muted }]}>
                  <Text style={[s.badgeText, { color: colors.mutedForeground }]}>{goal.goalType}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: goal.status === "completed" ? "#22c55e20" : colors.primary + "20" }]}>
                  <Text style={[s.statusText, { color: goal.status === "completed" ? "#22c55e" : colors.primary }]}>{goal.status}</Text>
                </View>
              </View>
              {goal.description ? (
                <Text style={[s.desc, { color: colors.mutedForeground }]}>{goal.description}</Text>
              ) : null}
              {progressPct !== null && (
                <View style={s.progressSection}>
                  <View style={s.progressLabelRow}>
                    <Text style={[s.progressLabel, { color: colors.mutedForeground }]}>Progress</Text>
                    <Text style={[s.progressValue, { color: colors.primary }]}>
                      {goal.currentValue ?? 0} / {goal.targetValue}
                    </Text>
                  </View>
                  <View style={[s.progressTrack, { backgroundColor: colors.muted }]}>
                    <View style={[s.progressFill, { backgroundColor: colors.primary, width: `${Math.round(progressPct * 100)}%` }]} />
                  </View>
                  <Text style={[s.progressPct, { color: colors.primary }]}>{Math.round(progressPct * 100)}%</Text>
                </View>
              )}
              {totalTasks > 0 && (
                <View style={s.statsRow}>
                  <View style={s.statItem}>
                    <Text style={[s.statValue, { color: colors.foreground }]}>{doneTasks}</Text>
                    <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Done</Text>
                  </View>
                  <View style={s.statItem}>
                    <Text style={[s.statValue, { color: colors.foreground }]}>{totalTasks - doneTasks}</Text>
                    <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Pending</Text>
                  </View>
                </View>
              )}
            </View>

            {totalTasks > 0 && (
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Tasks ({doneTasks}/{totalTasks})</Text>
            )}
          </>
        )}
        ListEmptyComponent={
          <View style={s.emptyTasks}>
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No tasks linked to this goal</Text>
          </View>
        }
        renderItem={({ item }) => {
          const done = item.status === "completed";
          return (
            <View style={[s.taskRow, { backgroundColor: colors.card, borderColor: colors.border, opacity: done ? 0.6 : 1 }]}>
              <Pressable
                style={[s.checkbox, { borderColor: done ? colors.success : colors.border, backgroundColor: done ? colors.success : "transparent" }]}
                onPress={() => !done && handleComplete(item.id)}
                hitSlop={8}
              >
                {done && <Feather name="check" size={14} color="#ffffff" />}
              </Pressable>
              <Text
                style={[s.taskTitle, { color: colors.cardForeground, textDecorationLine: done ? "line-through" : "none" }]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    center: { alignItems: "center", justifyContent: "center" },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
    backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    headerTitle: { flex: 1, fontSize: 20, fontWeight: "700" as const, fontFamily: "Inter_700Bold", textAlign: "center" },
    content: { paddingHorizontal: 20, gap: 12 },
    card: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 12 },
    cardTopRow: { flexDirection: "row", gap: 8 },
    typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontSize: 11, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
    statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    statusText: { fontSize: 11, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
    desc: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
    progressSection: { gap: 6 },
    progressLabelRow: { flexDirection: "row", justifyContent: "space-between" },
    progressLabel: { fontSize: 13, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
    progressValue: { fontSize: 13, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" as const },
    progressFill: { height: 8, borderRadius: 4 },
    progressPct: { fontSize: 22, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
    statsRow: { flexDirection: "row", gap: 24, paddingTop: 4 },
    statItem: { alignItems: "center", gap: 2 },
    statValue: { fontSize: 22, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
    statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
    sectionTitle: { fontSize: 17, fontWeight: "700" as const, fontFamily: "Inter_700Bold", marginTop: 8 },
    emptyTasks: { alignItems: "center", paddingVertical: 24 },
    emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
    taskRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, gap: 12 },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
    taskTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
    success: { color: "#22c55e" },
  });
