import { useUser, useClerk, useSession, useReverification } from "@clerk/react";
import { useState, useEffect } from "react";
import { LogOut, User, Bell, Palette, Info, Shield, Monitor, Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type ClerkSession = {
  id: string;
  status?: string;
  lastActiveAt?: Date | string;
  latestActivity?: {
    isMobile?: boolean;
    deviceType?: string;
    browserName?: string;
    browserVersion?: string;
    ipAddress?: string;
    city?: string;
    country?: string;
  };
  revoke: () => Promise<unknown>;
};

function maskIp(ip?: string): string {
  if (!ip) return "IP unavailable";
  if (ip.includes(".")) return ip.replace(/\.\d+$/, ".•••");      // IPv4 last octet
  return ip.replace(/:[^:]*$/, ":•••");                            // IPv6 last group
}

// Active sessions / devices via Clerk (KAN-2).
function ActiveSessions() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { session: current } = useSession();
  // Revoking a session is a protected action — useReverification handles Clerk's
  // step-up auth prompt when required, then retries.
  const revokeAction = useReverification((s: ClerkSession) => s.revoke());
  const [sessions, setSessions] = useState<ClerkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = (await user.getSessions()) as unknown as ClerkSession[];
      setSessions(list);
    } catch {
      toast.error("Couldn't load sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [user?.id]);

  const errMsg = (e: any, fallback: string) =>
    e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || e?.message || fallback;

  const revokeOne = async (s: ClerkSession, isCurrent: boolean) => {
    // The current session can't be revoked via the API — it's a sign-out.
    if (isCurrent) {
      if (!window.confirm("This will log you out immediately. Continue?")) return;
      await signOut({ redirectUrl: "/" });
      return;
    }
    setBusy(s.id);
    try {
      await revokeAction(s);
      await load();
      toast.success("Session revoked");
    } catch (e) {
      toast.error(errMsg(e, "Couldn't revoke session"));
    } finally {
      setBusy(null);
    }
  };

  const revokeOthers = async () => {
    const others = sessions.filter(s => s.id !== current?.id);
    if (others.length === 0) return;
    setBusy("others");
    try {
      for (const s of others) await revokeAction(s);
      await load();
      toast.success(`Signed out ${others.length} other device${others.length > 1 ? "s" : ""}`);
    } catch (e) {
      toast.error(errMsg(e, "Couldn't revoke sessions"));
    } finally {
      setBusy(null);
    }
  };

  const otherCount = sessions.filter(s => s.id !== current?.id).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-medium text-foreground">Active devices &amp; sessions</p>
          <p className="text-xs text-muted-foreground">Where you’re signed in. Revoke any you don’t recognise.</p>
        </div>
        {otherCount > 0 && (
          <Button variant="outline" size="sm" disabled={busy === "others"} onClick={revokeOthers} data-testid="revoke-others">
            Revoke all others
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No active sessions found.</p>
      ) : (
        <div className="space-y-2">
          {sessions.slice(0, 20).map(s => {
            const isCurrent = s.id === current?.id;
            const a = s.latestActivity ?? {};
            const mobile = a.isMobile || a.deviceType === "mobile";
            const browser = [a.browserName, a.browserVersion].filter(Boolean).join(" ") || "Unknown browser";
            const loc = [a.city, a.country].filter(Boolean).join(", ") || "Location unavailable";
            const expired = !!s.status && s.status !== "active";
            return (
              <div
                key={s.id}
                data-testid={`session-${s.id}`}
                className={`flex items-center gap-3 rounded-lg border p-3 ${isCurrent ? "border-primary/40 bg-primary/5" : "border-border"}`}
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  {mobile ? <Smartphone className="w-4 h-4 text-muted-foreground" /> : <Monitor className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{browser}</p>
                    {isCurrent && <Badge variant="default" className="h-5">This device</Badge>}
                    {expired && <Badge variant="secondary" className="h-5">Expired</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {loc} · {maskIp(a.ipAddress)} · {s.lastActiveAt ? formatDistanceToNow(new Date(s.lastActiveAt), { addSuffix: true }) : "—"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive flex-shrink-0"
                  disabled={busy === s.id}
                  onClick={() => revokeOne(s, isCurrent)}
                  data-testid={`revoke-${s.id}`}
                >
                  Revoke
                </Button>
              </div>
            );
          })}
          {sessions.length > 20 && (
            <p className="text-xs text-muted-foreground">Showing the 20 most recent sessions.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "U";

  return (
    <div className="p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Account */}
      <Card className="border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {user?.emailAddresses?.[0]?.emailAddress}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              data-testid="manage-account"
              onClick={() => openUserProfile()}
            >
              Manage
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Account created</p>
              <p className="text-xs text-muted-foreground">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security (managed by Clerk) */}
      <Card className="border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Two-factor authentication</p>
              <p className="text-xs text-muted-foreground">
                Authenticator app (TOTP) &amp; backup codes, with “remember this device”.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant={user?.twoFactorEnabled ? "default" : "secondary"}>
                {user?.twoFactorEnabled ? "On" : "Off"}
              </Badge>
              <Button variant="outline" size="sm" data-testid="manage-2fa" onClick={() => openUserProfile()}>
                {user?.twoFactorEnabled ? "Manage" : "Set up"}
              </Button>
            </div>
          </div>

          <Separator />

          <ActiveSessions />
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <p className="text-sm text-muted-foreground mb-3">Toggle dark/light mode from the user menu in the sidebar.</p>
          <div className="flex gap-2">
            <button
              data-testid="theme-light"
              onClick={() => {
                document.documentElement.classList.remove("dark");
                localStorage.setItem("theme", "light");
              }}
              className="flex-1 p-3 rounded-lg border border-border hover:border-primary transition-colors text-center"
            >
              <div className="w-full h-10 bg-white rounded-md border border-gray-200 mb-2 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-teal-600" />
              </div>
              <p className="text-xs font-medium text-foreground">Light</p>
            </button>
            <button
              data-testid="theme-dark"
              onClick={() => {
                document.documentElement.classList.add("dark");
                localStorage.setItem("theme", "dark");
              }}
              className="flex-1 p-3 rounded-lg border border-border hover:border-primary transition-colors text-center"
            >
              <div className="w-full h-10 bg-gray-900 rounded-md border border-gray-700 mb-2 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-teal-400" />
              </div>
              <p className="text-xs font-medium text-foreground">Dark</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            About FlowDeck
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Version</span>
            <Badge variant="secondary">1.0.0</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Modules</span>
            <span className="text-foreground">Goals · Tasks · Habits · Focus</span>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/20">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold text-destructive">Sign out</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <p className="text-sm text-muted-foreground mb-3">You'll be returned to the home page.</p>
          <Button
            variant="destructive"
            size="sm"
            data-testid="sign-out-settings"
            onClick={() => signOut({ redirectUrl: "/" })}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
