import {
  useCompleteTask,
  useCreateTask,
  useDeleteTask,
  useListGoals,
  useListTasks,
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Priority = "urgent" | "high" | "normal" | "low";
type TaskFilter = "today" | "pending" | "completed";

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "#dc2626",
  high: "#ef4444",
  normal: "#f59e0b",
  low: "#22c55e",
};

export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";

  const [filter, setFilter] = useState<TaskFilter>("pending");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("normal");
  const [newGoalId, setNewGoalId] = useState<number | null>(null);
  const [newDueDate, setNewDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const { data: tasks, isLoading } = useListTasks(
    filter === "today"
      ? { dueDate: today }
      : filter === "completed"
      ? { status: "completed" }
      : { status: "pending" },
  );

  const { data: goals } = useListGoals({ status: "active" });
  const completeTask = useCompleteTask();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();

  const handleComplete = async (id: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeTask.mutateAsync({ id });
    await queryClient.invalidateQueries({ queryKey: ["listTasks"] });
    await queryClient.invalidateQueries({ queryKey: ["getTodaysTasks"] });
  };

  const handleDelete = (id: number, title: string) => {
    Alert.alert("Delete Task", `Delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTask.mutateAsync({ id });
          await queryClient.invalidateQueries({ queryKey: ["listTasks"] });
        },
      },
    ]);
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await createTask.mutateAsync({
        data: {
          title: newTitle.trim(),
          priority: newPriority,
          ...(newGoalId ? { goalId: newGoalId } : {}),
          ...(newDueDate ? { dueDate: newDueDate } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["listTasks"] });
      setShowAdd(false);
      setNewTitle("");
      setNewPriority("normal");
      setNewGoalId(null);
      setNewDueDate("");
    } catch {
      Alert.alert("Error", "Failed to create task.");
    } finally {
      setSaving(false);
    }
  };

  const s = styles(colors);
  const topPad = isWeb ? 67 : insets.top;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 16 }]}>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Tasks</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAdd(true); }}
          testID="add-task-button"
        >
          <Feather name="plus" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <View style={[s.filters, { borderBottomColor: colors.border }]}>
        {(["pending", "today", "completed"] as TaskFilter[]).map((f) => (
          <Pressable
            key={f}
            style={[s.filterTab, filter === f && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, { color: filter === f ? colors.primary : colors.mutedForeground }]}>
              {f === "today" ? "Today" : f === "pending" ? "Active" : "Done"}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !tasks?.length ? (
        <View style={s.center}>
          <Feather name="check-square" size={40} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No tasks here</Text>
          <Text style={[s.emptySubText, { color: colors.mutedForeground }]}>Tap + to add a task</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[s.list, { paddingBottom: isWeb ? 34 : insets.bottom + 100 }]}
          scrollEnabled={!!(tasks && tasks.length > 0)}
          renderItem={({ item }) => {
            const isCompleted = item.status === "completed";
            const goal = goals?.find((g) => g.id === item.goalId);
            return (
              <Pressable
                style={[s.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: isCompleted ? 0.6 : 1 }]}
                onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleDelete(item.id, item.title); }}
                testID={`task-row-${item.id}`}
              >
                <Pressable
                  style={[s.checkbox, { borderColor: isCompleted ? colors.success : colors.border, backgroundColor: isCompleted ? colors.success : "transparent" }]}
                  onPress={() => !isCompleted && handleComplete(item.id)}
                  hitSlop={8}
                >
                  {isCompleted && <Feather name="check" size={14} color="#ffffff" />}
                </Pressable>
                <View style={s.rowContent}>
                  <Text style={[s.rowTitle, { color: colors.cardForeground, textDecorationLine: isCompleted ? "line-through" : "none" }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={s.rowMeta}>
                    <View style={[s.priorityBadge, { backgroundColor: PRIORITY_COLORS[item.priority as Priority] + "20" }]}>
                      <Text style={[s.priorityText, { color: PRIORITY_COLORS[item.priority as Priority] }]}>
                        {item.priority}
                      </Text>
                    </View>
                    {goal && (
                      <View style={[s.goalBadge, { backgroundColor: colors.muted }]}>
                        <Text style={[s.goalText, { color: colors.mutedForeground }]} numberOfLines={1}>{goal.title}</Text>
                      </View>
                    )}
                    {item.dueDate && (
                      <Text style={[s.dueDate, { color: colors.mutedForeground }]}>
                        <Feather name="calendar" size={11} /> {item.dueDate}
                      </Text>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={showAdd} animationType="slide" transparent presentationStyle="overFullScreen">
        <Pressable style={s.modalOverlay} onPress={() => setShowAdd(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.modalTitle, { color: colors.foreground }]}>New Task</Text>

            <TextInput
              style={[s.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Task title"
              placeholderTextColor={colors.mutedForeground}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            <Text style={[s.modalLabel, { color: colors.mutedForeground }]}>Priority</Text>
            <View style={s.chipRow}>
              {(["high", "medium", "low"] as Priority[]).map((p) => (
                <Pressable
                  key={p}
                  style={[s.chip, { backgroundColor: newPriority === p ? PRIORITY_COLORS[p] : colors.muted }]}
                  onPress={() => setNewPriority(p)}
                >
                  <Text style={[s.chipText, { color: newPriority === p ? "#ffffff" : colors.foreground }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {goals && goals.length > 0 && (
              <>
                <Text style={[s.modalLabel, { color: colors.mutedForeground }]}>Linked Goal (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.chipRow}>
                    <Pressable
                      style={[s.chip, { backgroundColor: newGoalId === null ? colors.primary : colors.muted }]}
                      onPress={() => setNewGoalId(null)}
                    >
                      <Text style={[s.chipText, { color: newGoalId === null ? colors.primaryForeground : colors.foreground }]}>None</Text>
                    </Pressable>
                    {goals.map((g) => (
                      <Pressable
                        key={g.id}
                        style={[s.chip, { backgroundColor: newGoalId === g.id ? colors.primary : colors.muted, marginRight: 8 }]}
                        onPress={() => setNewGoalId(g.id)}
                      >
                        <Text style={[s.chipText, { color: newGoalId === g.id ? colors.primaryForeground : colors.foreground }]} numberOfLines={1}>
                          {g.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            <Pressable
              style={({ pressed }) => [s.modalBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={handleAdd}
              disabled={saving || !newTitle.trim()}
            >
              {saving ? <ActivityIndicator color={colors.primaryForeground} /> : (
                <Text style={[s.modalBtnText, { color: colors.primaryForeground }]}>Create Task</Text>
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
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
    headerTitle: { fontSize: 28, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
    addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    filters: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 20 },
    filterTab: { paddingVertical: 10, paddingHorizontal: 16, marginRight: 4 },
    filterText: { fontSize: 14, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    emptyText: { fontSize: 18, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", marginTop: 12 },
    emptySubText: { fontSize: 14, fontFamily: "Inter_400Regular" },
    list: { padding: 16, gap: 10 },
    row: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
    rowContent: { flex: 1, gap: 6 },
    rowTitle: { fontSize: 15, fontFamily: "Inter_500Medium", fontWeight: "500" as const, lineHeight: 20 },
    rowMeta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" as const },
    priorityBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    priorityText: { fontSize: 11, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
    goalBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, maxWidth: 120 },
    goalText: { fontSize: 11, fontFamily: "Inter_400Regular" },
    dueDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
    success: { color: "#22c55e" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center" as const, marginBottom: 8 },
    modalTitle: { fontSize: 20, fontWeight: "700" as const, fontFamily: "Inter_700Bold", marginBottom: 4 },
    modalLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const, marginTop: 4 },
    modalInput: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 16, fontFamily: "Inter_400Regular" },
    chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" as const },
    chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
    chipText: { fontSize: 14, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
    modalBtn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
    modalBtnText: { fontSize: 16, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  });
