import { useParams, Link } from "wouter";
import {
  useGetGoal,
  useGetGoalProgress,
  useListTasks,
  useUpdateGoal,
  getListGoalsQueryKey,
  getGetGoalQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Target, CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState } from "react";

export default function GoalDetail() {
  const { id } = useParams<{ id: string }>();
  const goalId = Number(id);
  const qc = useQueryClient();

  const { data: goal, isLoading } = useGetGoal(goalId);
  const { data: progress } = useGetGoalProgress(goalId);
  const { data: tasks } = useListTasks({ goalId: goalId });
  const update = useUpdateGoal();

  const [editing, setEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState("");

  const handleUpdateProgress = () => {
    const val = Number(currentValue);
    if (isNaN(val)) { toast.error("Enter a valid number"); return; }
    update.mutate({ id: goalId, data: { currentValue: val } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetGoalQueryKey(goalId) });
        qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });
        toast.success("Progress updated");
        setEditing(false);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-16">
        <p className="text-muted-foreground">Goal not found.</p>
        <Link href="/goals"><Button variant="outline" className="mt-3">Back to goals</Button></Link>
      </div>
    );
  }

  const pct = progress?.percent ?? 0;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/goals">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{goal.title}</h1>
          {goal.description && <p className="text-sm text-muted-foreground mt-0.5">{goal.description}</p>}
        </div>
      </div>

      {/* Progress card */}
      <Card className="border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Progress</h2>
            <span className="text-2xl font-bold text-primary">{pct}%</span>
          </div>
          <Progress value={pct} className="h-3 mb-3" />
          {goal.goalType === "quantitative" && (
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
              <span>Current: <span className="text-foreground font-medium">{goal.currentValue ?? 0}</span></span>
              <span>Target: <span className="text-foreground font-medium">{goal.targetValue ?? "—"}</span></span>
            </div>
          )}
          {editing ? (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Update current value</Label>
                <Input
                  type="number"
                  value={currentValue}
                  onChange={e => setCurrentValue(e.target.value)}
                  placeholder={String(goal.currentValue ?? 0)}
                  className="mt-1"
                />
              </div>
              <Button size="sm" onClick={handleUpdateProgress} disabled={update.isPending}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => { setEditing(true); setCurrentValue(String(goal.currentValue ?? 0)); }}>
              Update progress
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Details</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium text-foreground capitalize mt-0.5">{goal.goalType}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Priority</dt>
              <dd className="font-medium text-foreground capitalize mt-0.5">{goal.priority}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium text-foreground capitalize mt-0.5">{goal.status}</dd>
            </div>
            {goal.targetEndDate && (
              <div>
                <dt className="text-muted-foreground">Target date</dt>
                <dd className="font-medium text-foreground mt-0.5">{goal.targetEndDate}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Linked tasks */}
      {tasks && tasks.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Linked Tasks ({tasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-1.5">
            {tasks.map(task => (
              <div key={task.id} className="flex items-center gap-2.5 py-1">
                {task.status === "completed"
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                <span className={`text-sm flex-1 ${task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {task.title}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
