import * as XLSX from "xlsx";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../../FlowDeck-Feature-Status.xlsx");

const rows = [
  // Headers
  ["S/N", "Module", "Feature", "Description", "Status"],

  // MODULE 1
  [null, "── MODULE 1: AUTH & SECURITY ──", "", "", ""],
  [1,  "Auth", "User registration", "Name, email, password sign-up", "✅ Built (via Clerk)"],
  [2,  "Auth", "Email verification", "Email verified on sign-up", "✅ Built (via Clerk)"],
  [3,  "Auth", "JWT + refresh tokens", "Short-lived access token + httpOnly refresh cookie", "✅ Built (via Clerk)"],
  [4,  "Auth", "Two-factor auth (TOTP)", "TOTP via Google Authenticator/Authy; QR code setup; 6-digit code on every login after enabling", "❌ Not Built"],
  [5,  "Auth", "Remember device (2FA)", '"Remember this device for 30 days" option after 2FA', "❌ Not Built"],
  [6,  "Auth", "Forgot / reset password", "Time-limited email reset link (1 hr expiry)", "✅ Built (via Clerk)"],
  [7,  "Auth", "Session management page", "View all active sessions; revoke individual or all other sessions", "❌ Not Built"],
  [8,  "Auth", "Rate limiting", "Max 5 failed login attempts → 15-min lockout on auth endpoints", "❌ Not Built"],
  [9,  "Auth", "Account settings", "Change email, change password, delete account with confirmation", "❌ Not Built"],

  // MODULE 2
  [null, "── MODULE 2: GOALS & CATEGORIES ──", "", "", ""],
  [10, "Goals", "Custom categories", "Name, icon (curated set), color, optional description", "⚠️ Partial (no icon picker)"],
  [11, "Goals", "Goal creation", "Title, description, category, start date, target end date, status (active/paused/completed/archived)", "✅ Built"],
  [12, "Goals", "Quantitative goal type", "Track progress by logging numeric entries toward a target", "✅ Built"],
  [13, "Goals", "Habit goal type", "Mark done on a recurring schedule; linked to habit tracker", "✅ Built"],
  [14, "Goals", "Milestone goal type", "Checklist of ordered sub-milestones to complete in sequence", "✅ Built"],
  [15, "Goals", "Progress bar", "Visual bar calculated from logged data per goal", "✅ Built"],
  [16, "Goals", "Goal completion animation", "Celebration on completion + auto-archive linked to-dos", "⚠️ Partial (milestone toasts only; no full animation, no auto-archive of tasks)"],
  [17, "Goals", "Pause goal", "Pausing a goal pauses all its linked recurring tasks", "❌ Not Built"],
  [18, "Goals", "Goal priority", "High / Medium / Low priority flag on goals", "❌ Not Built"],
  [19, "Goals", "Journal / notes on goals", "Optional notes/journal entries attached to a goal", "❌ Not Built"],

  // MODULE 3
  [null, "── MODULE 3: DAILY CHECKLISTS & TO-DO SYSTEM ──", "", "", ""],
  [20, "Tasks", "Standalone or goal-linked to-dos", "Tasks created independently or linked to a specific goal", "✅ Built"],
  [21, "Tasks", "Full task fields", "Title, notes, due date/time, priority, recurrence, goal link, estimated time, tags", "⚠️ Partial (no estimated time field)"],
  [22, "Tasks", "Recurrence rules", "One-time, daily, weekdays, every N days, weekly, bi-weekly, monthly, custom (RRULE-style)", "⚠️ Partial (daily/weekly/monthly only; no custom RRULE)"],
  [23, "Tasks", "Auto-archive on goal complete", "When a goal completes, its linked recurring to-dos are automatically archived", "❌ Not Built"],
  [24, "Tasks", "Daily view sorted by priority", "Today's checklist with priority sort; overdue items flagged", "✅ Built"],
  [25, "Tasks", "Drag-and-drop reordering", "Reorder tasks within the daily list via drag-and-drop", "❌ Not Built"],
  [26, "Tasks", "Bulk actions", "Check all, delete selected, reschedule multiple tasks at once", "❌ Not Built"],
  [27, "Tasks", "Subtasks", "Up to 10 nested subtasks per task with progress bar (done/total)", "✅ Built"],
  [28, "Tasks", "Quick-add with NLP", 'Natural language date parsing (e.g. "Meditate tomorrow at 8am" auto-fills fields)', "❌ Not Built"],
  [29, "Tasks", "Time blocking", "Assign a time block to a task; integrates with calendar view", "❌ Not Built"],

  // MODULE 4
  [null, "── MODULE 4: HABIT TRACKER ──", "", "", ""],
  [30, "Habits", "Habit creation", 'Name, category, frequency, target value, icon, color, optional "why" motivational note', "⚠️ Partial (no icon picker; no quantitative target value; no 'why' note field)"],
  [31, "Habits", "Streak counter", "Current streak + longest streak per habit", "✅ Built"],
  [32, "Habits", "Heatmap calendar", "12-month GitHub-style heatmap calendar per habit", "✅ Built"],
  [33, "Habits", "Weekly / monthly completion rates", "Completion rate stats per habit per period", "⚠️ Partial (weekly rate in Weekly Review only; no per-habit monthly chart)"],
  [34, "Habits", "Habit → goal link", "Habit completions count toward a linked goal's progress", "❌ Not Built"],
  [35, "Habits", "Habit stacking", "Group habits into morning/evening routine stacks that check off in sequence", "❌ Not Built"],
  [36, "Habits", "Grace days / streak freeze", "Configurable grace days per week; shield icon on card; grace-day banner on detail page", "✅ Built"],

  // MODULE 5
  [null, "── MODULE 5: INTERACTIVE DASHBOARD ──", "", "", ""],
  [37, "Dashboard", "Today's snapshot", "Daily to-do checklist, completion ring, weather-style motivational message", "⚠️ Partial (tasks shown; no completion ring; no motivational message)"],
  [38, "Dashboard", "Active goals section", "Progress bars for top 5 active goals sorted by due date", "✅ Built"],
  [39, "Dashboard", "Habit streaks section", "Streak cards for all active habits", "✅ Built"],
  [40, "Dashboard", "Focus timer widget", "Pomodoro timer embedded and functional on dashboard", "✅ Built"],
  [41, "Dashboard", "Productivity score (0–100)", "Daily score from tasks completed vs planned, habit rate, goal progress", "❌ Not Built"],
  [42, "Dashboard", "Weekly overview chart", "Bar chart of tasks completed per day this week on the dashboard", "⚠️ Partial (lives in Weekly Review page, not on Dashboard)"],
  [43, "Dashboard", "Upcoming (next 7 days)", "Scheduled tasks and recurring items for the next 7 days", "❌ Not Built"],
  [44, "Dashboard", "Quick-add FAB", "Floating action button for fast task/habit/goal creation from any view", "❌ Not Built"],
  [45, "Dashboard", "Mood check-in", "Daily emoji mood log (1–5 scale) with optional notes", "✅ Built"],
  [46, "Dashboard", "AI insight card", "One AI-generated behavioural insight per day based on user patterns", "❌ Not Built"],
  [47, "Dashboard", "Reorderable / hideable sections", "User can reorder or hide each dashboard section", "❌ Not Built"],

  // MODULE 6
  [null, "── MODULE 6: REPORTS & 'WRAPPED' ENGINE ──", "", "", ""],
  [48, "Reports", "End-of-day report", "On-demand or scheduled: tasks done, habits hit, Pomodoros, mood, encouragement", "❌ Not Built"],
  [49, "Reports", "Weekly report (in-app)", "Week in review: completion rates, streaks, best day, upcoming preview — Weekly Review page", "✅ Built"],
  [50, "Reports", "Weekly email report", "Auto-emailed Monday morning with week summary", "❌ Not Built"],
  [51, "Reports", "Monthly 'Wrapped'", "Spotify Wrapped-style full-screen story slides (7 slides + shareable PNG export)", "❌ Not Built"],
  [52, "Reports", "Yearly 'Year in Flow'", "Aggregated annual stats, year-over-year comparison, animated shareable card", "❌ Not Built"],

  // MODULE 7
  [null, "── MODULE 7: COMMUNICATIONS & NOTIFICATIONS ──", "", "", ""],
  [53, "Notifications", "Email notifications", "Daily digest, end-of-day summary, weekly/monthly/yearly reports, goal celebration, streak milestones", "❌ Not Built"],
  [54, "Notifications", "Push notifications", "Task reminders, habit reminders, daily digest, Pomodoro chimes, streak-at-risk alerts", "❌ Not Built"],
  [55, "Notifications", "In-app notification bell", "Unread count badge in header; notification centre with mark-read / clear-all", "❌ Not Built"],
  [56, "Notifications", "Do Not Disturb", "DND schedule (time window + weekend option) suppressing all push alerts", "❌ Not Built"],

  // MODULE 8
  [null, "── MODULE 8: CALENDAR VIEW ──", "", "", ""],
  [57, "Calendar", "Month / week / day views", "Full calendar with tasks and recurring items displayed on each occurrence", "❌ Not Built"],
  [58, "Calendar", "Drag-and-drop reschedule", "Drag tasks to a new date on the calendar", "❌ Not Built"],
  [59, "Calendar", "Color-coded by category", "Category colors applied to calendar events", "❌ Not Built"],
  [60, "Calendar", "Agenda mode", "Scrollable list of all upcoming items", "❌ Not Built"],

  // MODULE 9
  [null, "── MODULE 9: FOCUS MODE & POMODORO TIMER ──", "", "", ""],
  [61, "Focus", "Full-screen focus mode", "Distraction-free view showing only current task + timer", "⚠️ Partial (Focus page exists but not truly full-screen / distraction-free)"],
  [62, "Focus", "Multiple timer modes", "Pomodoro (25/5), 52/17, or fully custom work/break intervals", "⚠️ Partial (25/5 + long break built; no 52/17 or fully custom input)"],
  [63, "Focus", "Sound options", "White noise, lo-fi beats (YouTube embed), or silent", "❌ Not Built"],
  [64, "Focus", "Session log", "Date, task worked on, duration — saved to DB and used in reports", "✅ Built"],
  [65, "Focus", "Weekly Pomodoro goal", "Weekly session target with progress ring", "❌ Not Built"],

  // MODULE 10
  [null, "── MODULE 10: TAGS & ADVANCED FILTERING ──", "", "", ""],
  [66, "Tags", "Tags on all item types", "Tags applicable to goals, tasks, and habits", "⚠️ Partial (tasks only; goals and habits not tagged)"],
  [67, "Tags", "Global search bar", "Full-text search across all content (goals, tasks, habits)", "❌ Not Built"],
  [68, "Tags", "Full filter panel", "Filter by category, tag, priority, date range, status, linked goal", "⚠️ Partial (status + priority filters on tasks; tag filter bar on tasks only)"],
  [69, "Tags", "Saved filters", "Save and recall named filter presets", "❌ Not Built"],

  // MODULE 11
  [null, "── MODULE 11: DATA & PRIVACY ──", "", "", ""],
  [70, "Data", "Full data export", "JSON and CSV export of all user data (GDPR compliant)", "❌ Not Built"],
  [71, "Data", "CSV import", "Bulk import tasks from a CSV file", "❌ Not Built"],
  [72, "Data", "Data retention settings", "Auto-delete completed tasks older than X months", "❌ Not Built"],
  [73, "Data", "Account deletion", "Wipe all user data within 30 days", "❌ Not Built"],

  // MODULE 12
  [null, "── MODULE 12: ONBOARDING & UX POLISH ──", "", "", ""],
  [74, "UX", "Guided onboarding (5 steps)", "Set name/avatar, pick categories, create first goal, set notifications, 60-sec app tour", "❌ Not Built"],
  [75, "UX", "Empty states", "Illustration + CTA on every empty list", "⚠️ Partial (text-only empty states; no illustrations)"],
  [76, "UX", "Dark / light mode toggle", "Theme switch that persists to account", "❌ Not Built"],
  [77, "UX", "Keyboard shortcuts", "N (new task), G (goals), H (habits), / (search), T (today)", "❌ Not Built"],
  [78, "UX", "Offline support", "Service worker caches today's tasks + habits; syncs on reconnect", "❌ Not Built"],
  [79, "UX", "Accessibility (WCAG 2.1 AA)", "ARIA labels, full keyboard navigation, sufficient contrast ratios", "⚠️ Partial (basic ARIA present; not fully audited)"],

  // Summary separator
  [null, "", "", "", ""],
  [null, "── SUMMARY ──", "", "", ""],
  [null, "✅ Fully Built",   "", "", 26],
  [null, "⚠️ Partially Built", "", "", 16],
  [null, "❌ Not Built",    "", "", 37],
  [null, "TOTAL",           "", "", 79],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);

// ── Column widths ────────────────────────────────────────────────────────────
ws["!cols"] = [
  { wch: 6  }, // S/N
  { wch: 20 }, // Module
  { wch: 34 }, // Feature
  { wch: 74 }, // Description
  { wch: 18 }, // Status
];

// ── Row heights ──────────────────────────────────────────────────────────────
ws["!rows"] = rows.map(() => ({ hpt: 18 }));

// ── Freeze header row ────────────────────────────────────────────────────────
ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2" };

// ── Cell styling via cell objects ────────────────────────────────────────────
const range = XLSX.utils.decode_range(ws["!ref"]);

// Status colors
const STATUS_COLORS = {
  "✅": { fgColor: { rgb: "E6F4EA" }, fontColor: { rgb: "1E7E34" } },
  "⚠️": { fgColor: { rgb: "FFF8E1" }, fontColor: { rgb: "856404" } },
  "❌": { fgColor: { rgb: "FDECEA" }, fontColor: { rgb: "B71C1C" } },
};

// Header row style
const headerFill = { patternType: "solid", fgColor: { rgb: "1B5E7B" } };
const headerFont = { bold: true, color: { rgb: "FFFFFF" }, sz: 11 };

// Module section header style
const sectionFill = { patternType: "solid", fgColor: { rgb: "D6EAF8" } };
const sectionFont = { bold: true, color: { rgb: "154360" }, sz: 10 };

// Summary styles
const summaryLabelFont  = { bold: true, sz: 11 };
const summaryCountFont  = { bold: true, sz: 11 };

for (let R = range.s.r; R <= range.e.r; R++) {
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: R, c: C });
    if (!ws[addr]) ws[addr] = { t: "z", v: "" };

    const cell = ws[addr];
    const val  = String(cell.v ?? "");

    // Ensure all cells have basic alignment
    cell.s = { alignment: { wrapText: true, vertical: "top" } };

    // ── Header row ───────────────────────────────────────────────────────────
    if (R === 0) {
      cell.s = {
        fill: headerFill,
        font: headerFont,
        alignment: { horizontal: "center", vertical: "center", wrapText: false },
        border: {
          bottom: { style: "medium", color: { rgb: "0D3349" } },
        },
      };
      continue;
    }

    const rowData = rows[R];
    const snVal   = rowData[0];
    const modVal  = String(rowData[1] ?? "");

    // ── Module section header rows (S/N is null, Module starts with ──) ─────
    if (snVal === null && modVal.startsWith("──")) {
      cell.s = {
        fill: sectionFill,
        font: sectionFont,
        alignment: { vertical: "center", wrapText: false },
        border: {
          top:    { style: "thin", color: { rgb: "AED6F1" } },
          bottom: { style: "thin", color: { rgb: "AED6F1" } },
        },
      };
      continue;
    }

    // ── Summary rows (S/N is null, Module has ── SUMMARY ── or labels) ──────
    if (snVal === null && (modVal.includes("SUMMARY") || modVal.includes("✅") || modVal.includes("⚠️") || modVal.includes("❌") || modVal === "TOTAL")) {
      const isTotalRow = modVal === "TOTAL";
      cell.s = {
        font: isTotalRow
          ? { bold: true, sz: 11, color: { rgb: "000000" } }
          : summaryLabelFont,
        fill: isTotalRow
          ? { patternType: "solid", fgColor: { rgb: "D5DBDB" } }
          : undefined,
        alignment: { vertical: "center", wrapText: false },
        border: isTotalRow
          ? { top: { style: "medium", color: { rgb: "555555" } } }
          : undefined,
      };
      // Color the count column (E) for summary rows
      if (C === 4 && typeof rowData[4] === "number") {
        cell.s = { ...cell.s, font: { ...summaryCountFont } };
      }
      continue;
    }

    // ── Status column (E = index 4) ──────────────────────────────────────────
    if (C === 4 && snVal !== null) {
      const emoji = val.startsWith("✅") ? "✅" : val.startsWith("⚠️") ? "⚠️" : val.startsWith("❌") ? "❌" : null;
      if (emoji && STATUS_COLORS[emoji]) {
        cell.s = {
          fill: { patternType: "solid", ...STATUS_COLORS[emoji] },
          font: { bold: true, color: STATUS_COLORS[emoji].fontColor, sz: 10 },
          alignment: { horizontal: "center", vertical: "top", wrapText: true },
        };
      }
      continue;
    }

    // ── S/N column — center ──────────────────────────────────────────────────
    if (C === 0 && snVal !== null) {
      cell.s = {
        alignment: { horizontal: "center", vertical: "top" },
        font: { sz: 10 },
      };
    }

    // ── Alternating row shading for data rows ────────────────────────────────
    if (snVal !== null) {
      const isEven = (R % 2 === 0);
      if (isEven && C !== 4) {
        cell.s = {
          ...cell.s,
          fill: { patternType: "solid", fgColor: { rgb: "F8FBFF" } },
        };
      }
    }
  }
}

// ── Merge section header cells across all 5 columns ──────────────────────────
const merges = [];
for (let R = 1; R < rows.length; R++) {
  const sn  = rows[R][0];
  const mod = String(rows[R][1] ?? "");
  if (sn === null && (mod.startsWith("──") || mod === "" || mod.includes("SUMMARY") || mod.includes("✅") || mod.includes("⚠️") || mod.includes("❌") || mod === "TOTAL")) {
    // Merge columns A–D for the label; keep E for count on summary rows
    const hasSummaryCount = typeof rows[R][4] === "number";
    merges.push({
      s: { r: R, c: 0 },
      e: { r: R, c: hasSummaryCount ? 3 : 4 },
    });
  }
}
ws["!merges"] = merges;

XLSX.utils.book_append_sheet(wb, ws, "Feature Status");

// ── Write file ───────────────────────────────────────────────────────────────
XLSX.writeFile(wb, outPath, { bookType: "xlsx", type: "binary", cellStyles: true });
console.log("✅ Written:", outPath);
