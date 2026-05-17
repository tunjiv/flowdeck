import {
  useCreateGoal,
  useDeleteGoal,
  useListGoals,
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

type GoalType = "quantitative" | "habit" | "milestone";
type Priority = "high" | "medium" | "low";
type StatusFilter = "active" | "all" | "completed";

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  quantitative: "Numeric",
  habit: "Habit",
  milestone: "Milestone",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

export default function GoalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";

  const [filter, setFilter] = useState<StatusFilter>("active");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<GoalType>("milestone");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newTarget, setNewTarget] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: goals, isLoading } = useListGoals(
    filter === "all" ? {} : filter === "active" ? { status: "active" } : { status: "completed" },
  );

  const createGoal = useCreateGoal();
  const deleteGoal = useDeleteGoal();

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await createGoal.mutateAsync({
        data: {
          title: newTitle.trim(),
          goalType: newType,
          priority: newPriority,
          ...(newType === "quantitative" && newTarget ? { targetValue: parseFloat(newTarget) } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["listGoals"] });
      setShowAdd(false);
      setNewTitle("");
      setNewTarget("");
      setNewType("milestone");
      setNewPriority("medium");
    } catch {
      Alert.alert("Error", "Failed to create goal.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number, title: string) => {
    Alert.alert("Delete Goal", `Delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteGoal.mutateAsync({ id });
          await queryClient.invalidateQueries({ queryKey: ["listGoals"] });
        },
      },
    ]);
  };

  const getProgress = (goal: { goalType: string; currentValue?: number | null; targetValue?: number | null }) => {
    if (goal.goalType !== "quantitative") return null;
    if (!goal.targetValue || goal.targetValue === 0) return null;
    return Math.min(1, (goal.currentValue ?? 0) / goal.targetValue);
  };

  const s = styles(colors);
  const topPad = isWeb ? 67 : insets.top;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: topPad + 16 }]}>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>Goals</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAdd(true); }}
          testID="add-goal-button"
        >
          <Feather name="plus" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <View style={[s.filters, { borderBottomColor: colors.border }]}>
        {(["active", "all", "completed"] as StatusFilter[]).map((f) => (
          <Pressable
            key={f}
            style={[s.filterTab, filter === f && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, { color: filter === f ? colors.primary : colors.mutedForeground }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !goals?.length ? (
        <View style={s.center}>
          <Feather name="target" size={40} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No goals yet</Text>
          <Text style={[s.emptySubText, { color: colors.mutedForeground }]}>Tap + to create your first goal</Text>
        </View>
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[s.list, { paddingBottom: isWeb ? 34 : insets.bottom + 100 }]}
          scrollEnabled={!!(goals && goals.length > 0)}
          renderItem={({ item }) => {
            const progress = getProgress(item);
            return (
              <Pressable
                style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleDelete(item.id, item.title); }}
                testID={`goal-card-${item.id}`}
              >
                <View style={s.cardTop}>
                  <View style={s.cardMeta}>
                    <View style={[s.typeBadge, { backgroundColor: colors.muted }]}>
                      <Text style={[s.badgeText, { color: colors.mutedForeground }]}>
                        {GOAL_TYPE_LABELS[item.goalType as GoalType] ?? item.goalType}
                      </Text>
                    </View>
                    <View style={[s.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority as Priority] ?? colors.mutedForeground }]} />
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: item.status === "completed" ? "#22c55e20" : colors.primary + "20" }]}>
                    <Text style={[s.statusText, { color: item.status === "completed" ? "#22c55e" : colors.primary }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Text style={[s.cardTitle, { color: colors.cardForeground }]}>{item.title}</Text>
                {item.description ? (
                  <Text style={[s.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text>
                ) : null}
                {progress !== null && (
                  <View style={s.progressContainer}>
                    <View style={[s.progressTrack, { backgroundColor: colors.muted }]}>
                      <View style={[s.progressFill, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} />
                    </View>
                    <Text style={[s.progressLabel, { color: colors.mutedForeground }]}>
                      {item.currentValue ?? 0} / {item.targetValue}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={showAdd} animationType="slide" transparent presentationStyle="overFullScreen">
        <Pressable style={s.modalOverlay} onPress={() => setShowAdd(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.modalTitle, { color: colors.foreground }]}>New Goal</Text>

            <TextInput
              style={[s.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Goal title"
              placeholderTextColor={colors.mutedForeground}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            <Text style={[s.modalLabel, { color: colors.mutedForeground }]}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              {(["milestone", "quantitative", "habit"] as GoalType[]).map((t) => (
                <Pressable
                  key={t}
                  style={[s.chip, { backgroundColor: newType === t ? colors.primary : colors.muted, borderColor: colors.border }]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[s.chipText, { color: newType === t ? colors.primaryForeground : colors.foreground }]}>
                    {GOAL_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {newType === "quantitative" && (
              <TextInput
                style={[s.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Target value (e.g. 100)"
                placeholderTextColor={colors.mutedForeground}
                value={newTarget}
                onChangeText={setNewTarget}
                keyboardType="numeric"
              />
            )}

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

            <Pressable
              style={({ pressed }) => [s.modalBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={handleAdd}
              disabled={saving || !newTitle.trim()}
            >
              {saving ? <ActivityIndicator color={colors.primaryForeground} /> : (
                <Text style={[s.modalBtnText, { color: colors.primaryForeground }]}>Create Goal</Text>
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
    list: { padding: 16, gap: 12 },
    card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
    typeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontSize: 11, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" as const },
    priorityDot: { width: 8, height: 8, borderRadius: 4 },
    statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    statusText: { fontSize: 11, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" as const },
    cardTitle: { fontSize: 16, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    cardDesc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
    progressContainer: { gap: 4, marginTop: 4 },
    progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" as const },
    progressFill: { height: 6, borderRadius: 3 },
    progressLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center" as const, marginBottom: 8 },
    modalTitle: { fontSize: 20, fontWeight: "700" as const, fontFamily: "Inter_700Bold", marginBottom: 4 },
    modalLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", fontWeight: "600" as const, marginTop: 4 },
    modalInput: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 16, fontFamily: "Inter_400Regular" },
    chipScroll: { marginVertical: 4 },
    chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" as const },
    chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
    chipText: { fontSize: 14, fontFamily: "Inter_500Medium", fontWeight: "500" as const },
    modalBtn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
    modalBtnText: { fontSize: 16, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  });
