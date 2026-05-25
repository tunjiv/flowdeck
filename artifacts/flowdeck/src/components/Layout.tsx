import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  LayoutDashboard, Target, CheckSquare, Repeat, Tag, Timer, Settings,
  Menu, LogOut, Moon, Sun, CalendarDays, Search,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/categories", label: "Categories", icon: Tag },
  { href: "/settings", label: "Settings", icon: Settings },
];

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });
  const toggle = () => {
    setDark(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return next;
    });
  };
  return { dark, toggle };
}

function useSidebarOpen() {
  const [open, setOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-open") !== "false";
    }
    return true;
  });
  const toggle = () => setOpen(prev => {
    const next = !prev;
    localStorage.setItem("sidebar-open", String(next));
    return next;
  });
  return { open, toggle, setOpen };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { open, toggle: toggleSidebar, setOpen } = useSidebarOpen();
  const { dark, toggle: toggleDark } = useDarkMode();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // On mobile, close on Escape
  useEffect(() => {
    if (!isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile, setOpen]);

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "U";

  const currentPage = navItems.find(n => location === n.href || location.startsWith(n.href + "/"))?.label ?? "FlowDeck";

  const sidebar = (
    <aside
      className="h-full w-[260px] flex-shrink-0 flex flex-col bg-card border-r border-border overflow-hidden"
      data-testid="sidebar-panel"
    >
      {/* Header row: hamburger + search */}
      <div className="flex items-center gap-1 px-3 py-3">
        <button
          onClick={() => isMobile ? setOpen(false) : toggleSidebar()}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close menu"
          data-testid="close-sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/60 text-muted-foreground text-xs">
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
        </div>
      </div>

      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 pt-1 pb-3">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-primary-foreground">
            <rect x="3" y="4" width="6" height="16" rx="1.5" fill="currentColor" opacity="0.9"/>
            <rect x="13" y="9" width="6" height="11" rx="1.5" fill="currentColor" opacity="0.7"/>
          </svg>
        </div>
        <span className="font-bold text-base tracking-tight text-foreground">FlowDeck</span>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => { if (isMobile) setOpen(false); }}
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground/80 hover:bg-muted hover:text-foreground"
              }`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* User footer */}
      <div className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="user-menu-trigger"
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted transition-colors text-left"
            >
              <Avatar className="w-7 h-7">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.firstName ?? "User"} {user?.lastName ?? ""}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.emailAddresses?.[0]?.emailAddress}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={toggleDark} data-testid="toggle-theme">
              {dark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
              {dark ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut({ redirectUrl: "/" })}
              data-testid="sign-out"
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop: sidebar in flex layout (pushes content) */}
      {!isMobile && open && sidebar}

      {/* Mobile: sidebar as overlay */}
      {isMobile && open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="relative h-full">{sidebar}</div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center gap-3 px-4 h-12 flex-shrink-0">
          {!open && (
            <button
              onClick={() => isMobile ? setOpen(true) : toggleSidebar()}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              data-testid="open-sidebar"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-foreground">FlowDeck</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{currentPage}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
