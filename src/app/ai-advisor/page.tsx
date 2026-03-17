"use client";

import AppNavigation from "@/components/layout/AppNavigation";
import AIAdvisorChat from "@/components/analytics/AIAdvisorChat";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AIAdvisorPage() {
  const [userName, setUserName] = useState<string | undefined>();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserName(data.user.user_metadata?.name ?? data.user.email ?? undefined);
      }
    });
  }, []);

  return (
    <div className="flex min-h-screen bg-background-light text-text-main-light">
      <AppNavigation userName={userName} />

      {/* Full-height column so chat fills the viewport */}
      <main className="flex-1 flex flex-col px-10 pt-10 pb-6 max-w-3xl mx-auto w-full">
        {/* Minimal header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">AI Advisor</h1>
          <p className="text-text-muted-light">
            Your personal debt strategist — knows your loans, assets, and income in full.
          </p>
        </header>

        {/* Chat takes all remaining height */}
        <div className="flex-1 flex flex-col min-h-0">
          <AIAdvisorChat />
        </div>
      </main>
    </div>
  );
}
