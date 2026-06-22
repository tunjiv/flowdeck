import { useUser, useClerk } from "@clerk/react";
import { LogOut, User, Bell, Palette, Info, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
            <Badge variant={user?.twoFactorEnabled ? "default" : "secondary"}>
              {user?.twoFactorEnabled ? "On" : "Off"}
            </Badge>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium text-foreground">Active devices &amp; sessions</p>
            <p className="text-xs text-muted-foreground">
              Review where you’re signed in and sign out other devices.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="manage-security"
            onClick={() => openUserProfile()}
          >
            <Shield className="w-4 h-4 mr-2" />
            Manage security
          </Button>
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
