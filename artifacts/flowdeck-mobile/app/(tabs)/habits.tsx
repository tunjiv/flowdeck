import {
  useCreateHabit,
  useDeleteHabit,
  useDeleteHabitLog,
  useGetHabitStreaks,
  useListHabitLogs,
  useListHabits,
  useLogHabit,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const today = new Date().toISOString().split("T")[0]!;

function HabitStreakBadge({ habitId }: { habitId: number }) {
  const colors = useColors();
  const { data } = useGetHabitStreaks(habitId);
  if (!data?.currentStreak) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Feather name="zap" size={12} color="#f59e0b" />
      <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#f59e0b", fontWeight: "600" }}>
        {data.currentStreak}
      </Text>
    </View>
  );
}

export default function HabitsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const { data: habits, isLoading } = useListHabits();
  const { data: todayLogs, refetch: refetchLogs } = useListHabitLogs({ date: today });
  const logHabit = useLogHabit();
  const deleteLog = useDeleteHabitLog();
  const createHabit = useCreateHabit();
  const deleteHabit = useDeleteHabit();

  const completedIds = new Set(todayLogs?.map((l) => l.habitId) ?? []);
  const getLogId = (habitId: number) => todayLogs?.find((l) => l.habitId === habitId)?.id;

  const handleToggle = async (habitId: number) => {
    setTogglingId(habitId);
    const isCompleted = completedIds.has(habitId);
    try {
      if (isCompleted) {
        const logId = getLogId(habitId);
        if (logId) {
          await deleteLog.mutateAsync({ id: logId });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } else {
        await logHabit.mutateAsync({ data: { habitId, logDate: today } });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await refetchLogs();
      await queryClient.invalidateQueries({ queryKey: ["listHabitLogs"] });
    } catch {
      Alert.alert("Error", "Failed to update habit.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = (id: number, title: string) => {
    Alert.alert("Delete Habit", `Delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteHabit.mutateAsync({ id });
          await queryClient.invalidateQueries({ queryKey: ["listHabits"] });
        },
      },
    ]);
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await createHabit.mutateAsync({
        data: { name: newTitle.trim(), frequency: "daily", ...(newDesc ? { motivationNote: newDesc.trim() } : {}) },
      });
      await queryClient.invalidateQueries({ queryKey: ["listHabits"] });
      setShowAdd(false);
      setNewTitle("");
      setNewDesc("");
    } catch {
      Alert.alert("Error", "Failed to create habit.");
    } finally {
      setSaving(false);
    }
  };

  const doneCount = habits?.filter((h) => completedIds.has(h.id)).length ?? 0;
  const totalCount = habits?.length ?? 0;

  const s = styles(colors);
  const topPad = isWeb ? 67 : insets.top;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 16 }]}>
        <View>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Habits</Text>
          {totalCount > 0 && (
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>
              {doneCount}/{totalCount} done today
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAdd(true); }}
          testID="add-habit-button"
        >
          <Feather name="plus" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      {totalCount > 0 && (
        <View style={[s.progressBar, { backgroundColor: colors.muted, marginHorizontal: 20, marginBottom: 12 }]}>
          <View
            style={[s.progressFill, { backgroundColor: colors.primary, width: totalCount > 0 ? `${Math.round((doneCount / totalCount) * 100)}%` : "0%" }]}
          />
        </View>
      )}

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !habits?.length ? (
        <View style={s.center}>
          <Feather name="repeat" size={40} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No habits yet</Text>
          <Text style={[s.emptySubText, { color: colors.mutedForeground }]}>Tap + to build your first habit</Text>
        </View>
      ) : (
        <FlatList
          data={habits}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[s.list, { paddingBottom: isWeb ? 34 : insets.bottom + 100 }]}
          scrollEnabled={!!(habits && habits.length > 0)}
          renderItem={({ item }) => {
            const done = completedIds.has(item.id);
            const toggling = togglingId === item.id;
            return (
              <Pressable
                style={[s.card, { backgroundColor: colors.card, borderColor: done ? colors.primary + "40" : colors.border }]}
                onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleDelete(item.id, item.name); }}
                testID={`habit-card-${item.id}`}
              >
                <View style={s.cardLeft}>
                  <Text style={[s.cardTitle, { color: colors.cardForeground, textDecorationLine: done ? "line-through" : "none" }]}>
                    {item.name}
                  </Text>
                  {item.motivationNote ? (
                    <Text style={[s.cardDesc, { color: colors.mutedForeground }]} numberOfLines={1}>{item.motivationNote}</Text>
                  ) : null}
                  <HabitStreakBadge habitId={item.id} />
                </View>
                <Pressable
                  style={[
                    s.toggleBtn,
                    done
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: "transparent", borderWidth: 2, borderColor: colors.border },
                  ]}
                  onPress={() => handleToggle(item.id)}
                  disabled={toggling}
                  hitSlop={8}
                >
                  {toggling ? (
                    <ActivityIndicator size="small" color={done ? colors.primaryForeground : colors.mutedForeground} />
                  ) : (
                    <Feather name="check" size={18} color={done ? colors.primaryForeground : colors.mutedForeground} />
                  )}
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={showAdd} animationType="slide" transparent presentationStyle="overFullScreen">
        <Pressable style={s.modalOverlay} onPress={() => setShowAdd(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.modalTitle, { color: colors.foreground }]}>New Habit</Text>

            <TextInput
              style={[s.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Habit name (e.g. Morning run)"
              placeholderTextColor={colors.mutedForeground}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />
            <TextInput
              style={[s.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={newDesc}
              onChangeText={setNewDesc}
            />

            <Pressable
              style={({ pressed }) => [s.modalBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={handleAdd}
              disabled={saving || !newTitle.trim()}
            >
              {saving ? <ActivityIndicator color={colors.primaryForeground} /> : (
                <Text style={[s.modalBtnText, { color: colors.primaryForeground }]}>Create Habit</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
    headerTitle: { fontSize: 28, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
    headerSub: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },
    addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: 4 },
    progressBar: { height: 4, borderRadius: 2, overflow: "hidden" as const },
    progressFill: { height: 4, borderRadius: 2 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    emptyText: { fontSize: 18, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", marginTop: 12 },
    emptySubText: { fontSize: 14, fontFamily: "Inter_400Regular" },
    list: { padding: 16, gap: 10 },
    card: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
    cardLeft: { flex: 1, gap: 4 },
    cardTitle: { fontSize: 16, fontWeight: "500" as const, fontFamily: "Inter_500Medium" },
    cardDesc: { fontSize: 13, fontFamily: "Inter_400Regular" },
    toggleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center" as const, marginBottom: 8 },
    modalTitle: { fontSize: 20, fontWeight: "700" as const, fontFamily: "Inter_700Bold", marginBottom: 4 },
    modalInput: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 16, fontFamily: "Inter_400Regular" },
    modalBtn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
    modalBtnText: { fontSize: 16, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  });
