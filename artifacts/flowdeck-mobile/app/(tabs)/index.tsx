import {
  useCreateMoodLog,
  useGetTodaysMood,
  useListGoals,
  useListHabitLogs,
  useListHabits,
  useListTasks,
  useLogHabit,
  useDeleteHabitLog,
  useCompleteTask,
  useListFocusSessions,
} from "@workspace/api-client-react";
import { useUser } from "@clerk/clerk-expo";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const today = new Date().toISOString().split("T")[0]!;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function todayLabel() {
  const d = new Date();
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const MOOD_LABELS = ["Terrible", "Bad", "Okay", "Good", "Excellent"];
const MOOD_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

function greeting(name?: string | null) {
  const h = new Date().getHours();
  const g = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${g}, ${name.split(" ")[0]}` : g;
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useUser();
  const isWeb = Platform.OS === "web";

  const [refreshing, setRefreshing] = useState(false);
  const [moodSaving, setMoodSaving] = useState(false);
  const [togglingHabitId, setTogglingHabitId] = useState<number | null>(null);

  const { data: habits } = useListHabits();
  const { data: todayLogs, refetch: refetchLogs } = useListHabitLogs({ date: today });
  const { data: todayTasks } = useListTasks({ status: "pending", dueDate: today });
  const { data: goals } = useListGoals({ status: "active" });
  const { data: todayMood } = useGetTodaysMood();
  const { data: focusSessions } = useListFocusSessions();
  const createMood = useCreateMoodLog();
  const logHabit = useLogHabit();
  const deleteLog = useDeleteHabitLog();
  const completeTask = useCompleteTask();

  const completedHabitIds = new Set(todayLogs?.map((l) => l.habitId) ?? []);
  const getLogId = (habitId: number) => todayLogs?.find((l) => l.habitId === habitId)?.id;

  const todayFocusMinutes = focusSessions
    ? focusSessions.filter((s) => s.sessionDate === today).reduce((acc, s) => acc + s.durationMinutes, 0)
    : 0;

  const habitsDoneToday = habits?.filter((h) => completedHabitIds.has(h.id)).length ?? 0;
  const habitsTotal = habits?.length ?? 0;
  const tasksDueToday = todayTasks?.length ?? 0;
  const activeGoals = goals?.length ?? 0;

  const handleMood = async (rating: number) => {
    if (moodSaving || todayMood) return;
    setMoodSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await createMood.mutateAsync({ data: { mood: rating, logDate: today } });
      await queryClient.invalidateQueries({ queryKey: ["getTodaysMood"] });
    } finally {
      setMoodSaving(false);
    }
  };

  const handleHabitToggle = async (habitId: number) => {
    setTogglingHabitId(habitId);
    const isCompleted = completedHabitIds.has(habitId);
    try {
      if (isCompleted) {
        const logId = getLogId(habitId);
        if (logId) await deleteLog.mutateAsync({ id: logId });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        await logHabit.mutateAsync({ data: { habitId, logDate: today } });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await refetchLogs();
    } finally {
      setTogglingHabitId(null);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeTask.mutateAsync({ id: taskId });
    await queryClient.invalidateQueries({ queryKey: ["listTasks"] });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["listHabits"] }),
      queryClient.invalidateQueries({ queryKey: ["listHabitLogs"] }),
      queryClient.invalidateQueries({ queryKey: ["listTasks"] }),
      queryClient.invalidateQueries({ queryKey: ["listGoals"] }),
      queryClient.invalidateQueries({ queryKey: ["getTodaysMood"] }),
      queryClient.invalidateQueries({ queryKey: ["listFocusSessions"] }),
    ]);
    setRefreshing(false);
  };

  const topPad = isWeb ? 67 : insets.top;
  const s = styles(colors);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 16 }]}>
        <View>
          <Text style={[s.greeting, { color: colors.foreground }]}>{greeting(user?.firstName ?? user?.fullName)}</Text>
          <Text style={[s.dateLabel, { color: colors.mutedForeground }]}>{todayLabel()}</Text>
        </View>
        <View style={[s.logoMark, { backgroundColor: colors.primary }]}>
          <Text style={s.logoChar}>F</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: isWeb ? 34 : insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Stats */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="repeat" size={16} color={colors.primary} />
            <Text style={[s.statNum, { color: colors.foreground }]}>{habitsDoneToday}/{habitsTotal}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Habits</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="check-square" size={16} color={colors.primary} />
            <Text style={[s.statNum, { color: colors.foreground }]}>{tasksDueToday}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Tasks Due</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="target" size={16} color={colors.primary} />
            <Text style={[s.statNum, { color: colors.foreground }]}>{activeGoals}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Goals</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="clock" size={16} color={colors.primary} />
            <Text style={[s.statNum, { color: colors.foreground }]}>{todayFocusMinutes}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Mins</Text>
          </View>
        </View>

        {/* Mood Check-in */}
        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.sectionHeader}>
            <Feather name="smile" size={16} color={colors.primary} />
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>How are you feeling?</Text>
          </View>
          {todayMood ? (
            <View style={s.moodDone}>
              <View style={[s.moodDotLarge, { backgroundColor: MOOD_COLORS[todayMood.mood - 1] ?? colors.primary }]} />
              <Text style={[s.moodDoneText, { color: colors.foreground }]}>
                {MOOD_LABELS[todayMood.mood - 1] ?? "Good"} — mood logged
              </Text>
            </View>
          ) : (
            <View style={s.moodButtons}>
              {[1, 2, 3, 4, 5].map((r) => (
                <Pressable
                  key={r}
                  style={({ pressed }) => [s.moodBtn, { backgroundColor: MOOD_COLORS[r - 1], opacity: pressed || moodSaving ? 0.7 : 1 }]}
                  onPress={() => handleMood(r)}
                  disabled={moodSaving}
                >
                  <Text style={s.moodBtnText}>{r}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Today's Habits */}
        {habits && habits.length > 0 && (
          <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.sectionHeader}>
              <Feather name="repeat" size={16} color={colors.primary} />
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Today's Habits</Text>
              <Text style={[s.sectionCount, { color: colors.mutedForeground }]}>{habitsDoneToday}/{habitsTotal}</Text>
            </View>
            {habitsTotal > 0 && (
              <View style={[s.miniBar, { backgroundColor: colors.muted }]}>
                <View style={[s.miniBarFill, { backgroundColor: colors.primary, width: habitsTotal > 0 ? `${Math.round((habitsDoneToday / habitsTotal) * 100)}%` : "0%" }]} />
              </View>
            )}
            {habits.slice(0, 5).map((habit) => {
              const done = completedHabitIds.has(habit.id);
              const toggling = togglingHabitId === habit.id;
              return (
                <View key={habit.id} style={[s.habitRow, { borderTopColor: colors.border }]}>
                  <Text style={[s.habitName, { color: done ? colors.mutedForeground : colors.foreground, textDecorationLine: done ? "line-through" : "none" }]} numberOfLines={1}>
                    {habit.name}
                  </Text>
                  <Pressable
                    style={[s.miniCheck, { borderColor: done ? colors.primary : colors.border, backgroundColor: done ? colors.primary : "transparent" }]}
                    onPress={() => handleHabitToggle(habit.id)}
                    disabled={!!toggling}
                    hitSlop={8}
                  >
                    {toggling ? (
                      <ActivityIndicator size="small" color={done ? colors.primaryForeground : colors.mutedForeground} />
                    ) : done ? (
                      <Feather name="check" size={12} color={colors.primaryForeground} />
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* Today's Tasks */}
        {todayTasks && todayTasks.length > 0 && (
          <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.sectionHeader}>
              <Feather name="check-square" size={16} color={colors.primary} />
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Due Today</Text>
              <Text style={[s.sectionCount, { color: colors.mutedForeground }]}>{tasksDueToday} task{tasksDueToday !== 1 ? "s" : ""}</Text>
            </View>
            {todayTasks.slice(0, 5).map((task) => {
              const done = task.status === "completed";
              return (
                <View key={task.id} style={[s.taskRow, { borderTopColor: colors.border }]}>
                  <Pressable
                    style={[s.miniCheck, { borderColor: done ? colors.success : colors.border, backgroundColor: done ? colors.success : "transparent" }]}
                    onPress={() => !done && handleCompleteTask(task.id)}
                    hitSlop={8}
                  >
                    {done && <Feather name="check" size={12} color="#ffffff" />}
                  </Pressable>
                  <Text style={[s.taskName, { color: done ? colors.mutedForeground : colors.foreground, textDecorationLine: done ? "line-through" : "none" }]} numberOfLines={1}>
                    {task.title}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Active Goals */}
        {goals && goals.length > 0 && (
          <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.sectionHeader}>
              <Feather name="target" size={16} color={colors.primary} />
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Active Goals</Text>
            </View>
            {goals.slice(0, 4).map((goal) => {
              const progress =
                goal.goalType === "quantitative" && goal.targetValue && goal.targetValue > 0
                  ? Math.min(1, (goal.currentValue ?? 0) / goal.targetValue)
                  : null;
              return (
                <Pressable
                  key={goal.id}
                  style={[s.goalRow, { borderTopColor: colors.border }]}
                  onPress={() => router.push(`/goal/${goal.id}`)}
                >
                  <View style={s.goalLeft}>
                    <Text style={[s.goalName, { color: colors.foreground }]} numberOfLines={1}>{goal.title}</Text>
                    {progress !== null && (
                      <View style={[s.goalBar, { backgroundColor: colors.muted }]}>
                        <View style={[s.goalBarFill, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} />
                      </View>
                    )}
                  </View>
                  {progress !== null && (
                    <Text style={[s.goalPct, { color: colors.primary }]}>{Math.round(progress * 100)}%</Text>
                  )}
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
    greeting: { fontSize: 24, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
    dateLabel: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },
    logoMark: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    logoChar: { fontSize: 20, fontWeight: "700" as const, color: "#ffffff", fontFamily: "Inter_700Bold" },
    content: { paddingHorizontal: 16, gap: 12, paddingTop: 4 },
    statsRow: { flexDirection: "row", gap: 8 },
    statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
    statNum: { fontSize: 18, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
    statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" as const },
    section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    sectionTitle: { flex: 1, fontSize: 15, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    sectionCount: { fontSize: 13, fontFamily: "Inter_400Regular" },
    miniBar: { height: 4, borderRadius: 2, overflow: "hidden" as const, marginBottom: 2 },
    miniBarFill: { height: 4, borderRadius: 2 },
    habitRow: { flexDirection: "row", alignItems: "center", paddingTop: 10, borderTopWidth: 1, gap: 10 },
    habitName: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
    miniCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
    taskRow: { flexDirection: "row", alignItems: "center", paddingTop: 10, borderTopWidth: 1, gap: 10 },
    taskName: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
    goalRow: { flexDirection: "row", alignItems: "center", paddingTop: 10, borderTopWidth: 1, gap: 8 },
    goalLeft: { flex: 1, gap: 4 },
    goalName: { fontSize: 15, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
    goalBar: { height: 4, borderRadius: 2, overflow: "hidden" as const },
    goalBarFill: { height: 4, borderRadius: 2 },
    goalPct: { fontSize: 13, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", minWidth: 36, textAlign: "right" as const },
    moodButtons: { flexDirection: "row", gap: 8, justifyContent: "space-between" as const },
    moodBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    moodBtnText: { fontSize: 16, fontWeight: "700" as const, color: "#ffffff", fontFamily: "Inter_700Bold" },
    moodDone: { flexDirection: "row", alignItems: "center", gap: 10 },
    moodDotLarge: { width: 20, height: 20, borderRadius: 10 },
    moodDoneText: { fontSize: 15, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
    success: { color: "#22c55e" },
  });
