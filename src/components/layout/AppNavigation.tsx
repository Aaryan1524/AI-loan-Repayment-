"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  WalletCards,
  Banknote,
  Map,
  BarChart3,
  Sparkles,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/formatCurrency";

/* ─── Navigation items ─── */
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/loans", label: "My Loans", icon: WalletCards },
  { href: "/assets", label: "Assets & Income", icon: Banknote },
  { href: "/scenarios", label: "Scenarios", icon: Map },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/ai-advisor", label: "AI Advisor", icon: Sparkles },
];

interface AppNavigationProps {
  userName?: string;
}

export default function AppNavigation({ userName }: AppNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currency = useAppStore((s) => s.currency);
  const setCurrency = useAppStore((s) => s.setCurrency);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <aside className="no-print w-[240px] flex-shrink-0 flex flex-col border-r border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark py-8 px-4 h-screen sticky top-0">
      <div className="flex items-center gap-2 px-4 mb-10">
        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
        <span className="font-display font-bold text-xl tracking-tight">ClearDebt</span>
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted-light dark:text-text-muted-dark hover:bg-border-light/20 hover:text-text-main-light dark:hover:text-text-main-dark"
              }`}
            >
              <Icon size={20} className={active ? "text-primary" : "text-text-muted-light dark:text-text-muted-dark"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Currency Picker */}
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-3">
        <div className="text-xs font-bold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark mb-2">
          Currency
        </div>
        <div className="grid grid-cols-3 gap-1">
          {SUPPORTED_CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setCurrency(c.code as CurrencyCode)}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                currency === c.code
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted-light dark:text-text-muted-dark hover:bg-border-light/20 dark:hover:bg-border-dark/40"
              }`}
            >
              {c.symbol} {c.code}
            </button>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <div className="mt-auto space-y-3">
        {userName && (
          <div className="px-4 py-2">
            <div className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-0.5">
              Signed in as
            </div>
            <div className="text-sm font-medium text-text-main-light dark:text-text-main-dark truncate">
              {userName}
            </div>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-text-muted-light dark:text-text-muted-dark hover:bg-red-50 hover:text-red-600 transition-colors w-full"
        >
          <LogOut size={20} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
