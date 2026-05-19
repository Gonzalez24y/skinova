import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider } from "@clerk/clerk-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Pricing from "@/pages/pricing";
import Login from "@/pages/login";
import { AuthSync } from "@/components/auth-sync";

const queryClient = new QueryClient();

interface ClerkConfig {
  clerkPublishableKey: string;
  proxyUrl: string | null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/login" component={Login} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [config, setConfig] = useState<ClerkConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: ClerkConfig) => {
        setConfig(data);
      })
      .catch(() => {
        // fallback to env var if API call fails
        const envKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
        if (envKey) setConfig({ clerkPublishableKey: envKey, proxyUrl: null });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!config?.clerkPublishableKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-foreground font-medium">서비스에 연결할 수 없습니다.</p>
          <button
            className="text-sm text-primary underline"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  const clerkProps: Record<string, string> = {
    publishableKey: config.clerkPublishableKey,
  };
  if (config.proxyUrl) {
    clerkProps.proxyUrl = config.proxyUrl;
  }

  return (
    <ClerkProvider {...clerkProps}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
            <AuthSync />
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
