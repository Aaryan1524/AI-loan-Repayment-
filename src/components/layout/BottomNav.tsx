"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, WalletCards, Banknote, Map, BarChart3, Sparkles } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/loans", label: "Loans", icon: WalletCards },
  { href: "/assets", label: "Assets", icon: Banknote },
  { href: "/scenarios", label: "Scenarios", icon: Map },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/ai-advisor", label: "AI", icon: Sparkles },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Don't show on auth pages
  if (pathname === "/sign-in" || pathname === "/sign-up" || pathname === "/") {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 h-16 bg-[#FDFAF5] dark:bg-background-dark border-t border-[#E4D9C8] dark:border-border-dark flex md:hidden items-center justify-around px-1 z-40 no-print pb-safe">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              active ? "text-[#C17B4A]" : "text-[#B0A090]"
            }`}
          >
            <Icon size={18} />
            <span className="text-[9px] font-medium font-body leading-none text-center">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
