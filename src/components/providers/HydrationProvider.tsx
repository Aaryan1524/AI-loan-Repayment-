"use client";

/**
 * HydrationProvider — mounts once at the root layout level.
 *
 * As soon as the app loads (any page), this fires hydrateFromSupabase()
 * exactly once per session so every page has data immediately after render,
 * regardless of which route the user lands on or reloads.
 */

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";

export default function HydrationProvider({ children }: { children: React.ReactNode }) {
  const hydrateFromSupabase = useAppStore((s) => s.hydrateFromSupabase);
  const isHydrated = useAppStore((s) => s.isHydrated);
  const hasTriggered = useRef(false);

  useEffect(() => {
    // Only hydrate once per app session — guard against double StrictMode calls
    if (!isHydrated && !hasTriggered.current) {
      hasTriggered.current = true;
      hydrateFromSupabase();
    }
  }, [isHydrated, hydrateFromSupabase]);

  return <>{children}</>;
}
