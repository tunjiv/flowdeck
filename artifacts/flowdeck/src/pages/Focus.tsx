import { useState, useEffect, useRef, useCallback } from "react";
import {
  useListTasks,
  useCreateFocusSession,
  useListFocusSessions,
  getListFocusSessionsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Play, Pause, RotateCcw, Timer, CheckCircle2, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format } from "date-fns";

type Mode = "focus" | "short_break" | "long_break";

const MODES: Record<Mode, { label: string; minutes: number; color: string }> = {
  focus: { label: "Focus", minutes: 25, color: "text-primary" },
  short_break: { label: "Short break", minutes: 5, color: "text-green-500" },
  long_break: { label: "Long break", minutes: 15, color: "text-blue-500" },
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function Focus() {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: tasks } = useListTasks();
  const { data: sessions } = useListFocusSessions({ date: today });
  const createSession = useCreateFocusSession();

  const [mode, setMode] = useState<Mode>("focus");
  const [customMinutes, setCustomMinutes] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(MODES.focus.minutes * 60);
  const [completed, setCompleted] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = (customMinutes ?? MODES[mode].minutes) * 60;
  const pct = Math.round(((totalSeconds - secondsLeft) / totalSeconds) * 100);

  const resetTimer = useCallback((m: Mode, custom?: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setSecondsLeft((custom ?? MODES[m].minutes) * 60);
  }, []);

  const handleModeChange = (m: Mode) => {
    setMode(m);
    setCustomMinutes(null);
    resetTimer(m);
  };

  const handleCustomMinutes = (val: string) => {
    const n = Number(val);
    if (!isNaN(n) && n > 0 && n <= 120) {
      setCustomMinutes(n);
      setRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setSecondsLeft(n * 60);
    }
  };

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            const duration = customMinutes ?? MODES[mode].minutes;
            if (mode === "focus") {
              createSession.mutate({
                data: {
                  durationMinutes: duration,
                  sessionType: "pomodoro",
                  sessionDate: today,
                  taskId: selectedTaskId ? Number(selectedTaskId) : undefined,
                },
              }, {
                onSuccess: () => {
                  qc.invalidateQueries({ queryKey: getListFocusSessionsQueryKey() });
                  qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
                  toast.success("Focus session saved!");
                },
              });
              setCompleted(c => c + 1);
              toast.success("Time's up! Great session. 🎉");
            } else {
              toast.success("Break over!");
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode]);

  const pendingTasks = (tasks ?? []).filter(t => t.status === "pending");
  const todayMinutes = (sessions ?? []).reduce((sum, s) => sum + s.durationMinutes, 0);
  const todaySessions = (sessions ?? []).length;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Focus</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Stay in the zone with a timer</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{todaySessions}</p>
            <p className="text-xs text-muted-foreground">sessions today</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{todayMinutes}</p>
            <p className="text-xs text-muted-foreground">minutes today</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{completed}</p>
            <p className="text-xs text-muted-foreground">this run</p>
          </CardContent>
        </Card>
      </div>

      {/* Timer card */}
      <Card className="border-border">
        <CardContent className="p-6 space-y-5">
          {/* Mode selector */}
          <div className="flex gap-1.5 justify-center">
            {(Object.keys(MODES) as Mode[]).map(m => (
              <button
                key={m}
                data-testid={`mode-${m}`}
                onClick={() => handleModeChange(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  mode === m && !customMinutes
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {MODES[m].label}
              </button>
            ))}
          </div>

          {/* Timer display */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center">
              <svg className="w-48 h-48 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${(2 * Math.PI * 42) * (1 - pct / 100)}`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute text-center">
                <p className="text-4xl font-bold text-foreground tabular-nums">
                  {pad(Math.floor(secondsLeft / 60))}:{pad(secondsLeft % 60)}
                </p>
                <p className={`text-xs font-medium mt-0.5 ${MODES[mode].color}`}>
                  {customMinutes ? `Custom (${customMinutes}m)` : MODES[mode].label}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                data-testid="reset-timer"
                onClick={() => resetTimer(mode, customMinutes ?? undefined)}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                size="lg"
                className="px-10 gap-2"
                data-testid={running ? "pause-timer" : "start-timer"}
                onClick={() => setRunning(r => !r)}
              >
                {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {running ? "Pause" : secondsLeft === totalSeconds ? "Start" : "Resume"}
              </Button>
            </div>
          </div>

          {/* Custom duration */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Custom:</span>
            <div className="flex gap-1.5">
              {[10, 15, 20, 30, 45, 60].map(m => (
                <button
                  key={m}
                  data-testid={`custom-${m}`}
                  onClick={() => handleCustomMinutes(String(m))}
                  className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                    customMinutes === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {/* Task linking */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Link to task (optional)</p>
            <Select value={selectedTaskId || "none"} onValueChange={v => setSelectedTaskId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a task..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No task</SelectItem>
                {pendingTasks.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Recent sessions */}
      {sessions && sessions.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Today's sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-1.5">
            {sessions.slice(-5).reverse().map(session => (
              <div key={session.id} className="flex items-center gap-3 py-1.5">
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <span className="text-sm text-foreground flex-1">{session.durationMinutes} min</span>
                <span className="text-xs text-muted-foreground capitalize">{session.sessionType}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
