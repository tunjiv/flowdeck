import { useCreateFocusSession, useListTasks } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Mode = "work" | "shortBreak" | "longBreak";

const MODE_DURATION: Record<Mode, number> = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const MODE_LABELS: Record<Mode, string> = {
  work: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const RING_SIZE = 260;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function FocusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [mode, setMode] = useState<Mode>("work");
  const [timeLeft, setTimeLeft] = useState(MODE_DURATION.work);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showTaskPicker, setShowTaskPicker] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalTime = MODE_DURATION[mode];

  const { data: tasks } = useListTasks({ status: "pending" });
  const createSession = useCreateFocusSession();

  const handleSessionComplete = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsRunning(false);
    if (mode === "work") {
      setSessionCount((c) => c + 1);
      const todayISO = new Date().toISOString().split("T")[0]!;
      try {
        await createSession.mutateAsync({
          data: {
            durationMinutes: 25,
            sessionType: "pomodoro",
            sessionDate: todayISO,
            ...(selectedTaskId ? { taskId: selectedTaskId } : {}),
          },
        });
      } catch {
        // Silent — session save failure is non-critical
      }
    }
  }, [mode, selectedTaskId, createSession]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current!);
            handleSessionComplete();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, handleSessionComplete]);

  const handleModeChange = (m: Mode) => {
    if (isRunning) {
      Alert.alert("Timer Running", "Stop the timer before switching mode?", [
        { text: "Cancel", style: "cancel" },
        { text: "Switch", onPress: () => { setIsRunning(false); setMode(m); setTimeLeft(MODE_DURATION[m]); } },
      ]);
      return;
    }
    setMode(m);
    setTimeLeft(MODE_DURATION[m]);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(totalTime);
  };

  const progress = timeLeft / totalTime;
  const strokeDashoffset = RING_CIRCUMFERENCE * progress;

  const selectedTask = tasks?.find((t) => t.id === selectedTaskId);

  const s = styles(colors);
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 16 }]}>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Focus</Text>
        {sessionCount > 0 && (
          <View style={[s.sessionBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[s.sessionBadgeText, { color: colors.primary }]}>{sessionCount} done</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.modeRow}>
          {(["work", "shortBreak", "longBreak"] as Mode[]).map((m) => (
            <Pressable
              key={m}
              style={[s.modeBtn, mode === m && { backgroundColor: colors.primary }]}
              onPress={() => handleModeChange(m)}
            >
              <Text style={[s.modeBtnText, { color: mode === m ? colors.primaryForeground : colors.mutedForeground }]}>
                {MODE_LABELS[m]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={s.ringContainer}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={colors.muted}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={mode === "work" ? colors.primary : "#22c55e"}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <View style={s.ringInner}>
            <Text style={[s.timeText, { color: colors.foreground }]}>{formatTime(timeLeft)}</Text>
            <Text style={[s.modeLabel, { color: colors.mutedForeground }]}>{MODE_LABELS[mode]}</Text>
          </View>
        </View>

        <View style={s.controls}>
          <Pressable
            style={({ pressed }) => [s.resetBtn, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
            onPress={handleReset}
          >
            <Feather name="rotate-ccw" size={20} color={colors.mutedForeground} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.playBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsRunning((r) => !r); }}
            testID="focus-play-button"
          >
            <Feather name={isRunning ? "pause" : "play"} size={28} color={colors.primaryForeground} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.resetBtn, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
            onPress={() => setShowTaskPicker(!showTaskPicker)}
          >
            <Feather name="link" size={20} color={selectedTaskId ? colors.primary : colors.mutedForeground} />
          </Pressable>
        </View>

        {selectedTask && (
          <View style={[s.taskChip, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
            <Feather name="check-square" size={14} color={colors.primary} />
            <Text style={[s.taskChipText, { color: colors.primary }]} numberOfLines={1}>{selectedTask.title}</Text>
            <Pressable onPress={() => setSelectedTaskId(null)} hitSlop={8}>
              <Feather name="x" size={14} color={colors.primary} />
            </Pressable>
          </View>
        )}

        {showTaskPicker && tasks && tasks.length > 0 && (
          <View style={[s.taskPicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.taskPickerTitle, { color: colors.mutedForeground }]}>Link a task</Text>
            {tasks.slice(0, 8).map((task) => (
              <Pressable
                key={task.id}
                style={[
                  s.taskPickerRow,
                  selectedTaskId === task.id && { backgroundColor: colors.primary + "15" },
                  { borderTopColor: colors.border },
                ]}
                onPress={() => { setSelectedTaskId(task.id); setShowTaskPicker(false); }}
              >
                <Text style={[s.taskPickerText, { color: colors.foreground }]} numberOfLines={1}>{task.title}</Text>
                {selectedTaskId === task.id && <Feather name="check" size={16} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        )}

        <View style={[s.statsRow, { borderTopColor: colors.border }]}>
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: colors.foreground }]}>{sessionCount}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Sessions</Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: colors.border }]} />
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: colors.foreground }]}>{sessionCount * 25}</Text>
            <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Minutes</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 8 },
    headerTitle: { fontSize: 28, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
    sessionBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    sessionBadgeText: { fontSize: 13, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    content: { alignItems: "center", paddingHorizontal: 24, paddingTop: 16, gap: 24 },
    modeRow: { flexDirection: "row", gap: 8, backgroundColor: "transparent" },
    modeBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
    modeBtnText: { fontSize: 13, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    ringContainer: { alignItems: "center", justifyContent: "center" },
    ringInner: { position: "absolute", alignItems: "center", justifyContent: "center" },
    timeText: { fontSize: 56, fontWeight: "700" as const, fontFamily: "Inter_700Bold", letterSpacing: -2 },
    modeLabel: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
    controls: { flexDirection: "row", alignItems: "center", gap: 20 },
    playBtn: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
    resetBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
    taskChip: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, maxWidth: 300 },
    taskChipText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
    taskPicker: { width: "100%", borderRadius: 16, borderWidth: 1, overflow: "hidden" as const },
    taskPickerTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const, paddingHorizontal: 16, paddingVertical: 10, textTransform: "uppercase" as const, letterSpacing: 0.5 },
    taskPickerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, justifyContent: "space-between" },
    taskPickerText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
    statsRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, paddingTop: 20, width: "100%" },
    statItem: { flex: 1, alignItems: "center", gap: 4 },
    statValue: { fontSize: 28, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
    statLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
    statDivider: { width: 1, height: 40 },
  });
