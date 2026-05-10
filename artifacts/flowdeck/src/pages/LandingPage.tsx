import { Link } from "wouter";
import { ArrowRight, Target, CheckSquare, Repeat, Timer, BarChart2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Target, title: "Goal tracking", desc: "Set quantitative, habit, and milestone goals with progress bars." },
  { icon: CheckSquare, title: "Daily tasks", desc: "Prioritized daily checklists with recurrence and subtasks." },
  { icon: Repeat, title: "Habit streaks", desc: "Build habits with visual streaks and heatmap calendars." },
  { icon: Timer, title: "Focus timer", desc: "Pomodoro and custom intervals to keep you in flow." },
  { icon: BarChart2, title: "Weekly overview", desc: "See your progress across the week with clear charts." },
  { icon: Zap, title: "Productivity score", desc: "A daily score calculated from tasks, habits, and sessions." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-primary-foreground">
                <rect x="3" y="4" width="6" height="16" rx="1.5" fill="currentColor" opacity="0.9"/>
                <rect x="13" y="9" width="6" height="11" rx="1.5" fill="currentColor" opacity="0.7"/>
              </svg>
            </div>
            <span className="font-bold text-base text-foreground">FlowDeck</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" data-testid="nav-signin">Sign in</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" data-testid="nav-signup">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
          <Zap className="w-3 h-3" />
          Your productivity cockpit
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight leading-tight mb-4">
          The app you actually want<br className="hidden sm:block" /> to open every morning
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
          Track goals, build habits, crush your daily tasks, and measure your progress — all in one focused workspace.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/sign-up">
            <Button size="lg" className="gap-2" data-testid="hero-cta">
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" data-testid="hero-signin">
              Sign in
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-5 rounded-xl border border-border bg-card hover:shadow-md transition-shadow">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="bg-primary/5 border-t border-primary/10">
        <div className="max-w-5xl mx-auto px-6 py-14 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">Ready to get in flow?</h2>
          <p className="text-muted-foreground mb-6">Join and start building momentum today.</p>
          <Link href="/sign-up">
            <Button size="lg" className="gap-2" data-testid="footer-cta">
              Create your account
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        FlowDeck — built to help you make progress, not just stay busy.
      </footer>
    </div>
  );
}
