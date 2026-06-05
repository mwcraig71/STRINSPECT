import { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppSidebar } from "@/components/layout/sidebar";
import { SessionData } from "@/lib/types";

import BridgeSetup from "@/pages/bridge-setup";
import InspectionProgress from "@/pages/inspection-progress";
import ReviewExport from "@/pages/review-export";

const queryClient = new QueryClient();

function Router({
  sessionData,
  setSessionData,
}: {
  sessionData: SessionData | null;
  setSessionData: (data: SessionData | null) => void;
}) {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground dark">
      <AppSidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <Switch>
          <Route path="/" component={BridgeSetup} />
          <Route path="/progress">
            {() => <InspectionProgress sessionData={sessionData} setSessionData={setSessionData} />}
          </Route>
          <Route path="/review">
            {() => <ReviewExport sessionData={sessionData} setSessionData={setSessionData} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  // Force dark mode
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router sessionData={sessionData} setSessionData={setSessionData} />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
