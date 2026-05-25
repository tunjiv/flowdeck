import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronDown } from "lucide-react";
import {
  format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear,
} from "date-fns";

// Local-date formatter — using toISOString here would shift dates by one day
// outside UTC, breaking preset matching and inRange comparisons.
function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getPresets(): { [name: string]: { from?: Date; to?: Date } } {
  const now = new Date();
  return {
    Today:        { from: now, to: now },
    Yesterday:    { from: subDays(now, 1), to: subDays(now, 1) },
    "This Week":  { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) },
    "Last Week":  { from: startOfWeek(subDays(now, 7), { weekStartsOn: 1 }), to: endOfWeek(subDays(now, 7), { weekStartsOn: 1 }) },
    "This Month": { from: startOfMonth(now), to: endOfMonth(now) },
    "This Year":  { from: startOfYear(now),  to: endOfYear(now) },
    "All Time":   {},
  };
}

export function rangeLabel(range: DateRange | null, allTimeLabel = "Any date"): string {
  if (!range || (!range.from && !range.to)) return allTimeLabel;
  const presets = getPresets();
  for (const [name, p] of Object.entries(presets)) {
    const hasBoth = p.from && p.to && range.from && range.to;
    if (hasBoth &&
      dateToStr(p.from!) === dateToStr(range.from!) &&
      dateToStr(p.to!)   === dateToStr(range.to!)) {
      return name === "All Time" ? allTimeLabel : name;
    }
  }
  if (range.from && range.to) {
    if (dateToStr(range.from) === dateToStr(range.to))
      return format(range.from, "MMM d, yyyy");
    return `${format(range.from, "MMM d")} – ${format(range.to, "MMM d")}`;
  }
  if (range.from) return format(range.from, "MMM d, yyyy");
  return "Select dates";
}

export function inRange(dateStr: string, range: DateRange | null): boolean {
  if (!range || (!range.from && !range.to)) return true;
  if (range.from && !range.to) return dateStr >= dateToStr(range.from);
  if (!range.from && range.to) return dateStr <= dateToStr(range.to);
  return dateStr >= dateToStr(range.from!) && dateStr <= dateToStr(range.to!);
}

export function DateRangeFilter({
  value, onChange, allTimeLabel = "Any date",
}: {
  value: DateRange | null;
  onChange: (r: DateRange | null) => void;
  allTimeLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const presets = getPresets();

  const handlePreset = (name: string) => {
    const p = presets[name];
    if (!p) return;
    onChange(!p.from && !p.to ? null : { from: p.from, to: p.to });
    if (!p.from && !p.to) setOpen(false);
  };

  const activePreset = (() => {
    if (!value || (!value.from && !value.to)) return "All Time";
    for (const [name, p] of Object.entries(presets)) {
      if (p.from && p.to && value.from && value.to &&
        dateToStr(p.from) === dateToStr(value.from) &&
        dateToStr(p.to)   === dateToStr(value.to)) return name;
    }
    return null;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 text-sm font-medium">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          {rangeLabel(value, allTimeLabel)}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 shadow-lg" align="start">
        <div className="flex">
          <div className="border-r border-border p-2 flex flex-col gap-0.5 min-w-[120px]">
            {Object.keys(presets).map(name => (
              <button
                key={name}
                onClick={() => handlePreset(name)}
                className={`text-left text-sm px-3 py-1.5 rounded-md transition-colors ${
                  activePreset === name
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {name === "All Time" ? allTimeLabel : name}
              </button>
            ))}
          </div>
          <div className="p-2">
            <Calendar
              mode="range"
              selected={value ?? { from: undefined, to: undefined }}
              onSelect={(r) => onChange(r ?? null)}
              numberOfMonths={1}
              className="rounded-md"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
