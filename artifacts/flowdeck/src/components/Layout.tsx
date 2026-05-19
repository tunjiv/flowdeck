import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  LayoutDashboard,
  Target,
  CheckSquare,
  Repeat,
  Tag,
  Timer,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });
  const toggle = () => setCollapsed(prev => {
    const next = !prev;
    localStorage.setItem("sidebar-collapsed", String(next));
    return next;
  });
  return { collapsed, toggle };
}

interface SidebarProps {
  collapsed: boolean;
  toggleCollapsed: () => void;
  dark: boolean;
  toggleDark: () => void;
  forMobile?: boolean;
  onClose?: () => void;
  location: string;
  userImageUrl?: string;
  userFirstName?: string;
  userLastName?: string;
  userEmail?: string;
  onSignOut: () => void;
}

function DesktopSidebar({
  collapsed, toggleCollapsed, dark, toggleDark,
  location, userImageUrl, userFirstName, userLastName, userEmail, onSignOut,
}: SidebarProps) {
  const initials = userFirstName
    ? `${userFirstName[0]}${userLastName?.[0] ?? ""}`.toUpperCase()
    : "U";

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col h-full">
        {/* Logo + collapse toggle */}
        <div className={`flex items-center gap-2.5 px-4 py-4 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-primary-foreground">
              <rect x="3" y="4" width="6" height="16" rx="1.5" fill="currentColor" opacity="0.9"/>
              <rect x="13" y="9" width="6" height="11" rx="1.5" fill="currentColor" opacity="0.7"/>
            </svg>
          </div>
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight text-foreground flex-1">FlowDeck</span>
          )}
          <button
            onClick={toggleCollapsed}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <Separator className="mx-3 w-auto" />

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href + "/");
            const inner = (
              <Link key={href} href={href} data-testid={`nav-${label.toLowerCase()}`}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  collapsed ? "justify-center px-2" : ""
                } ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span>{label}</span>
                      {active && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
                    </>
                  )}
                </div>
              </Link>
            );

            return collapsed ? (
              <Tooltip key={href}>
                <TooltipTrigger asChild>{inner}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ) : inner;
          })}
        </nav>

        <Separator className="mx-3 w-auto" />

        {/* User footer */}
        <div className="p-2">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors">
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={userImageUrl} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="right" className="w-48">
                    <DropdownMenuItem onClick={toggleDark} data-testid="toggle-theme">
                      {dark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                      {dark ? "Light mode" : "Dark mode"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onSignOut} data-testid="sign-out" className="text-destructive focus:text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent side="right">{userFirstName ?? "Account"}</TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid="user-menu-trigger" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={userImageUrl} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{userFirstName ?? "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={toggleDark} data-testid="toggle-theme">
                  {dark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                  {dark ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSignOut} data-testid="sign-out" className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function MobileSidebar({ dark, toggleDark, location, userImageUrl, userFirstName, userLastName, userEmail, onSignOut, onClose }: SidebarProps) {
  const initials = userFirstName
    ? `${userFirstName[0]}${userLastName?.[0] ?? ""}`.toUpperCase()
    : "U";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-primary-foreground">
            <rect x="3" y="4" width="6" height="16" rx="1.5" fill="currentColor" opacity="0.9"/>
            <rect x="13" y="9" width="6" height="11" rx="1.5" fill="currentColor" opacity="0.7"/>
          </svg>
        </div>
        <span className="font-bold text-lg tracking-tight text-foreground flex-1">FlowDeck</span>
        <button className="p-1 rounded-md hover:bg-muted" onClick={onClose}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <Separator className="mx-3 w-auto" />

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link key={href} href={href} onClick={onClose} data-testid={`nav-${label.toLowerCase()}`}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
                {active && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
              </div>
            </Link>
          );
        })}
      </nav>

      <Separator className="mx-3 w-auto" />

      <div className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button data-testid="user-menu-trigger" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left">
              <Avatar className="w-7 h-7">
                <AvatarImage src={userImageUrl} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{userFirstName ?? "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={toggleDark} data-testid="toggle-theme">
              {dark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
              {dark ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut} data-testid="sign-out" className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dark, toggle: toggleDark } = useDarkMode();
  const { collapsed, toggle: toggleCollapsed } = useSidebarCollapsed();

  const sidebarProps: SidebarProps = {
    collapsed,
    toggleCollapsed,
    dark,
    toggleDark,
    location,
    userImageUrl: user?.imageUrl,
    userFirstName: user?.firstName ?? undefined,
    userLastName: user?.lastName ?? undefined,
    userEmail: user?.emailAddresses?.[0]?.emailAddress,
    onSignOut: () => signOut({ redirectUrl: "/" }),
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col border-r border-border bg-card flex-shrink-0 transition-all duration-200 ${collapsed ? "w-[60px]" : "w-56"}`}>
        <DesktopSidebar {...sidebarProps} />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 flex flex-col bg-card border-r border-border z-10">
            <MobileSidebar {...sidebarProps} forMobile onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button data-testid="mobile-menu" onClick={() => setMobileOpen(true)} className="p-1.5 rounded-md hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-base">FlowDeck</span>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
