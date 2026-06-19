import { useEffect, useState, useRef, createContext, useContext } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import Goals from "@/pages/Goals";
import GoalDetail from "@/pages/GoalDetail";
import Tasks from "@/pages/Tasks";
import Habits from "@/pages/Habits";
import HabitDetail from "@/pages/HabitDetail";
import Categories from "@/pages/Categories";
import Focus from "@/pages/Focus";
import Settings from "@/pages/Settings";
import WeeklyReview from "@/pages/WeeklyReview";
import NotFound from "@/pages/not-found";
import { CookieBanner } from "@/components/CookieBanner";

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
});

export function useAuthContext() {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [qc]);

  useEffect(() => {
    setAuthTokenGetter(() =>
      supabase.auth.getSession().then(({ data }) => data.session?.access_token ?? null),
    );
    return () => setAuthTokenGetter(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Auth pages
// ---------------------------------------------------------------------------

const authAppearance = {
  theme: ThemeSupa,
  variables: {
    default: {
      colors: {
        brand: "hsl(189, 88%, 28%)",
        brandAccent: "hsl(189, 88%, 22%)",
      },
      radii: {
        borderRadiusButton: "0.75rem",
        inputBorderRadius: "0.75rem",
      },
    },
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-[440px] max-w-full bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white">
              <rect x="3" y="4" width="6" height="16" rx="1.5" fill="currentColor" opacity="0.9" />
              <rect x="13" y="9" width="6" height="11" rx="1.5" fill="currentColor" opacity="0.7" />
            </svg>
          </div>
          <span className="font-bold text-base tracking-tight">FlowDeck</span>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={authAppearance}
          providers={["google", "github"]}
          redirectTo={`${window.location.origin}/dashboard`}
          localization={{
            variables: {
              sign_in: { email_label: "Email", password_label: "Password", button_label: "Sign in" },
            },
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

function NavigateToDashboard() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/dashboard");
  }, [navigate]);
  return null;
}

function HomeRedirect() {
  const { user, loading } = useAuthContext();
  if (loading) return null;
  return user ? <NavigateToDashboard /> : <LandingPage />;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuthContext();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/sign-in");
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function GoalDetailRoute({ backHref, showProgress }: { backHref?: string; showProgress?: boolean }) {
  const { user, loading } = useAuthContext();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/sign-in");
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  return (
    <Layout>
      <GoalDetail backHref={backHref} showProgress={showProgress} />
    </Layout>
  );
}

function HabitDetailRoute() {
  const { user, loading } = useAuthContext();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/sign-in");
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  return (
    <Layout>
      <HabitDetail />
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AppRouter() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in" component={SignInPage} />
          <Route path="/sign-up" component={SignInPage} />
          <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
          <Route path="/habits/goal/:id" component={() => <GoalDetailRoute backHref="/habits" showProgress={false} />} />
          <Route path="/goals/view/:id" component={() => <GoalDetailRoute backHref="/goals" showProgress={false} />} />
          <Route path="/goals/:id" component={() => <GoalDetailRoute />} />
          <Route path="/goals" component={() => <ProtectedRoute component={Goals} />} />
          <Route path="/tasks" component={() => <ProtectedRoute component={Tasks} />} />
          <Route path="/habits/:id" component={HabitDetailRoute} />
          <Route path="/habits" component={() => <ProtectedRoute component={Habits} />} />
          <Route path="/categories" component={() => <ProtectedRoute component={Categories} />} />
          <Route path="/focus" component={() => <ProtectedRoute component={Focus} />} />
          <Route path="/weekly-review" component={() => <ProtectedRoute component={WeeklyReview} />} />
          <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
          <Route component={NotFound} />
        </Switch>
        <Toaster richColors position="top-right" />
        <CookieBanner />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AppRouter />
    </WouterRouter>
  );
}

export default App;
