import { useEffect, useRef } from "react";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { SignIn, SignUp, useAuth, useUser } from "@clerk/react";
import { queryClient } from "@/lib/queryClient";
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
// Auth context (backed by Clerk)
// ---------------------------------------------------------------------------

export function useAuthContext() {
  const { isLoaded } = useAuth();
  const { user } = useUser();
  return { user: user ?? null, loading: !isLoaded };
}

// Bridges Clerk's session token into the API client, and clears cached
// query data when the signed-in user changes.
function ApiAuthBridge() {
  const { getToken, isLoaded, userId } = useAuth();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    const id = userId ?? null;
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== id) {
      qc.clear();
    }
    prevUserIdRef.current = id;
  }, [isLoaded, userId, qc]);

  return null;
}

// ---------------------------------------------------------------------------
// Auth pages
// ---------------------------------------------------------------------------

function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignIn routing="hash" signUpUrl="/sign-up" forceRedirectUrl="/dashboard" />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignUp routing="hash" signInUrl="/sign-in" forceRedirectUrl="/dashboard" />
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
      <ApiAuthBridge />
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-up" component={SignUpPage} />
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
