import { useEffect, useRef } from "react";
import { toast } from "sonner";

const MILESTONES = [25, 50, 75, 100] as const;
type Milestone = (typeof MILESTONES)[number];

const STORAGE_KEY = "flowdeck_goal_milestones";

function loadStore(): Record<number, Milestone[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveStore(store: Record<number, Milestone[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function milestoneEmoji(m: Milestone) {
  if (m === 100) return "🏆";
  if (m === 75)  return "🔥";
  if (m === 50)  return "⚡";
  return "🎯";
}

function milestoneLabel(m: Milestone) {
  if (m === 100) return "Goal complete! You crushed it!";
  if (m === 75)  return "75% there — almost done!";
  if (m === 50)  return "Halfway there — great momentum!";
  return "25% done — strong start!";
}

export type GoalLike = {
  id: number;
  title: string;
  goalType: string;
  currentValue?: number | null;
  targetValue?: number | null;
};

/**
 * Watches a list of goals and fires a toast the first time each goal
 * crosses a 25 / 50 / 75 / 100 % milestone. Seen milestones are
 * persisted to localStorage so they don't fire again on page reload.
 */
export function useGoalMilestoneTracker(goals: GoalLike[] | undefined) {
  // Track whether we've done the initial "hydrate from storage" pass
  const initialised = useRef(false);

  useEffect(() => {
    if (!goals || goals.length === 0) return;

    const store = loadStore();
    let changed = false;
    const newToasts: { title: string; milestone: Milestone }[] = [];

    for (const goal of goals) {
      if (goal.goalType !== "quantitative") continue;
      const target = goal.targetValue;
      if (!target || target <= 0) continue;
      const pct = Math.min(100, Math.round(((goal.currentValue ?? 0) / target) * 100));
      const seen = store[goal.id] ?? [];

      for (const m of MILESTONES) {
        if (pct >= m && !seen.includes(m)) {
          // Skip the very first load to avoid spamming old data
          if (initialised.current) {
            newToasts.push({ title: goal.title, milestone: m });
          }
          seen.push(m);
          store[goal.id] = seen;
          changed = true;
        }
      }

      // Clean up milestones that were previously stored but progress has
      // since dropped below them (e.g. user manually lowered currentValue)
      store[goal.id] = seen.filter(m => pct >= m);
    }

    if (changed) saveStore(store);

    // Show toasts after saving so repeated renders don't double-fire
    for (const { title, milestone } of newToasts) {
      toast(
        `${milestoneEmoji(milestone)} ${milestoneLabel(milestone)}`,
        {
          description: title,
          duration: 6000,
          className: milestone === 100
            ? "border-primary bg-primary/5"
            : "border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20",
        },
      );
    }

    initialised.current = true;
  }, [goals]);
}

/** Call this imperatively after an update.mutate onSuccess to check immediately. */
export function checkGoalMilestone(goal: GoalLike) {
  if (goal.goalType !== "quantitative") return;
  const target = goal.targetValue;
  if (!target || target <= 0) return;
  const pct = Math.min(100, Math.round(((goal.currentValue ?? 0) / target) * 100));

  const store = loadStore();
  const seen = store[goal.id] ?? [];
  let changed = false;

  for (const m of MILESTONES) {
    if (pct >= m && !seen.includes(m)) {
      toast(
        `${milestoneEmoji(m)} ${milestoneLabel(m)}`,
        {
          description: goal.title,
          duration: 6000,
          className: m === 100
            ? "border-primary bg-primary/5"
            : "border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20",
        },
      );
      seen.push(m);
      changed = true;
    }
  }

  if (changed) { store[goal.id] = seen; saveStore(store); }
}
