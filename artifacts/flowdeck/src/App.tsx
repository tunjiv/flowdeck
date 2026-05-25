import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, RedirectToSignIn, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
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
import Focus from "@/pages/Focus";
import Settings from "@/pages/Settings";
import WeeklyReview from "@/pages/WeeklyReview";
import NotFound from "@/pages/not-found";
import { CookieBanner } from "@/components/CookieBanner";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(189, 88%, 28%)",
    colorForeground: "hsl(222, 47%, 11%)",
    colorMutedForeground: "hsl(215, 16%, 47%)",
    colorDanger: "hsl(0, 84%, 60%)",
    colorBackground: "hsl(0, 0%, 100%)",
    colorInput: "hsl(214, 32%, 91%)",
    colorInputForeground: "hsl(222, 47%, 11%)",
    colorNeutral: "hsl(214, 32%, 91%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gray-900 font-semibold",
    headerSubtitle: "text-gray-500",
    socialButtonsBlockButtonText: "text-gray-700",
    formFieldLabel: "text-gray-700 font-medium",
    footerActionLink: "text-teal-700 hover:text-teal-800",
    footerActionText: "text-gray-500",
    dividerText: "text-gray-400",
    identityPreviewEditButton: "text-teal-700",
    formFieldSuccessText: "text-green-600",
    alertText: "text-gray-700",
    logoBox: "mb-1",
    logoImage: "h-8 w-8",
    socialButtonsBlockButton: "border border-gray-200 hover:bg-gray-50",
    formButtonPrimary: "bg-teal-700 hover:bg-teal-800 text-white",
    formFieldInput: "border-gray-200 bg-white text-gray-900",
    footerAction: "bg-gray-50",
    dividerLine: "bg-gray-200",
    alert: "bg-red-50 border-red-100",
    otpCodeFieldInput: "border-gray-200",
    formFieldRow: "gap-3",
    main: "p-6",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function NavigateToDashboard() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/dashboard"); }, [navigate]);
  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <NavigateToDashboard />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <Component />
        </Layout>
      </Show>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
    </>
  );
}

function GoalDetailRoute() {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <GoalDetail />
        </Layout>
      </Show>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
    </>
  );
}

function HabitDetailRoute() {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <HabitDetail />
        </Layout>
      </Show>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
    </>
  );
}

function AppRouter() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back to FlowDeck", subtitle: "Sign in to your account" } },
        signUp: { start: { title: "Start your flow", subtitle: "Create your FlowDeck account" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
          <Route path="/goals/:id" component={GoalDetailRoute} />
          <Route path="/goals" component={() => <ProtectedRoute component={Goals} />} />
          <Route path="/tasks" component={() => <ProtectedRoute component={Tasks} />} />
          <Route path="/habits/:id" component={HabitDetailRoute} />
          <Route path="/habits" component={() => <ProtectedRoute component={Habits} />} />
          <Route path="/focus" component={() => <ProtectedRoute component={Focus} />} />
          <Route path="/weekly-review" component={() => <ProtectedRoute component={WeeklyReview} />} />
          <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
          <Route component={NotFound} />
        </Switch>
        <Toaster richColors position="top-right" />
        <CookieBanner />
      </QueryClientProvider>
    </ClerkProvider>
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
