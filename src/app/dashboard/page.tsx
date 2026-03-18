"use client";

import { useAppStore, type Loan } from "@/lib/store";
import type { AdviceResponse } from "@/app/api/advice/route";
import LoanFormModal from "@/components/loans/LoanFormModal";
import { createClient } from "@/lib/supabase/client";
import { useFinancialData } from "@/hooks/useFinancialData";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  Home,
  GraduationCap,
  Car,
  CreditCard,
  Wallet,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import AppNavigation from "../../components/layout/AppNavigation";

/* ─── Icon mapping for loan types ─── */
const loanIcons: Record<string, { icon: React.ReactNode; bg: string; fg: string }> = {
  mortgage: {
    icon: <Home size={22} />,
    bg: "bg-[#E8F0EA] dark:bg-[#2c3d31]",
    fg: "text-[#5A7C60]",
  },
  student: {
    icon: <GraduationCap size={22} />,
    bg: "bg-[#EAEAF4] dark:bg-[#2d2d42]",
    fg: "text-[#6B6B99]",
  },
  auto: {
    icon: <Car size={22} />,
    bg: "bg-[#F5E8E5] dark:bg-[#422c28]",
    fg: "text-[#A65B50]",
  },
  credit_card: {
    icon: <CreditCard size={22} />,
    bg: "bg-[#F4EED1] dark:bg-[#423d21]",
    fg: "text-[#8C8040]",
  },
  personal: {
    icon: <Wallet size={22} />,
    bg: "bg-[#E8EAF0] dark:bg-[#2c2d3d]",
    fg: "text-[#5A607C]",
  },
  other: {
    icon: <Wallet size={22} />,
    bg: "bg-[#E8EAF0] dark:bg-[#2c2d3d]",
    fg: "text-[#5A607C]",
  },
};

/* ─── Helpers ─── */
function formatTerm(months: number) {
  if (months === 0) return "rolling";
  const yrs = Math.floor(months / 12);
  const mo = months % 12;
  if (yrs === 0) return `${mo} mo left`;
  if (mo === 0) return `${yrs} yrs left`;
  return `${yrs} yrs ${mo} mo left`;
}

/* ─── Bar widths for payoff timeline chart ─── */
const timelineBars = [
  { baseline: 90, optimized: 85 },
  { baseline: 80, optimized: 70 },
  { baseline: 70, optimized: 55 },
  { baseline: 60, optimized: 45 },
  { baseline: 50, optimized: 35 },
  { baseline: 45, optimized: 25 },
  { baseline: 40, optimized: 15 },
  { baseline: 35, optimized: 0 },
  { baseline: 30, optimized: 0 },
  { baseline: 25, optimized: 0 },
];

/* ─── Skeleton loader for AI insight ─── */
function InsightSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-border-light dark:bg-border-dark rounded w-3/4 mb-3" />
      <div className="h-4 bg-border-light dark:bg-border-dark rounded w-full mb-3" />
      <div className="h-4 bg-border-light dark:bg-border-dark rounded w-5/6 mb-6" />
      <div className="space-y-2">
        <div className="h-3 bg-border-light dark:bg-border-dark rounded w-2/3" />
        <div className="h-3 bg-border-light dark:bg-border-dark rounded w-3/4" />
        <div className="h-3 bg-border-light dark:bg-border-dark rounded w-1/2" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const addLoan = useAppStore((s) => s.addLoan);
  const currency = useAppStore((s) => s.currency);

  /* ─── Unified financial data ─── */
  const {
    loans, assets,
    totalDebt, payoffDate, totalInterestSaved,
    suggestedLumpSums, calcResult, isLoading,
    resolvedScenario,
  } = useFinancialData();

  const loanCount = loans.length;

  /* ─── User info ─── */
  const [userName, setUserName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const fullName = user.user_metadata?.full_name || user.email || "";
        const firstName = fullName.split(" ")[0];
        setUserName(firstName);
      }
    });
  }, []);

  /* ─── AI Advice — debounced on loans changes ─── */
  const [advice, setAdvice] = useState<AdviceResponse | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fetchIdRef = useRef(0);

  const fetchAdvice = useCallback(async () => {
    if (loans.length === 0) {
      setAdvice({
        insight: "Add your first loan to get personalised AI-powered advice on your repayment strategy.",
        suggestions: [
          "Click the + button below to add a loan",
          "Or head to My Loans to manage your portfolio",
        ],
      });
      setAdviceLoading(false);
      return;
    }

    const id = ++fetchIdRef.current;
    setAdviceLoading(true);
    try {
      const res = await fetch("/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loans: loans.map((l) => ({
            name: l.name,
            balance: l.balance,
            rate: l.rate,
            termMonths: l.termMonths,
          })),
          assets: assets.map((a) => ({
            name: a.name,
            value: a.value,
            returnRate: a.returnRate,
            maturityDate: a.maturityDate,
          })),
          totalDebt,
          payoffDate: payoffDate?.toISOString() ?? new Date().toISOString(),
          totalInterestSaved,
          suggestedLumpSums,
          strategy: resolvedScenario?.strategy ?? "avalanche",
          currency,
        }),
      });
      const data: AdviceResponse = await res.json();
      if (id === fetchIdRef.current) {
        setAdvice(data);
      }
    } catch {
      if (id === fetchIdRef.current) {
        setAdvice({
          insight: "Unable to connect to AI Advisor. Your data is still being tracked accurately.",
          suggestions: ["Check your internet connection and try refreshing"],
        });
      }
    } finally {
      if (id === fetchIdRef.current) {
        setAdviceLoading(false);
      }
    }
  }, [loans, assets, totalDebt, payoffDate, totalInterestSaved, suggestedLumpSums, resolvedScenario, currency]);

  // Debounced effect: re-fetch AI advice 1500ms after loans change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchAdvice();
    }, 1500);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [fetchAdvice]);

  /* ─── Floating Add Loan modal ─── */
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAddLoan = (loan: Loan) => {
    addLoan(loan);
  };

  /* ─── Derived display values ─── */
  const payoffMonth = calcResult && payoffDate
    ? payoffDate.toLocaleDateString("en-US", { month: "short" })
    : "—";
  const payoffYear = calcResult && payoffDate ? payoffDate.getFullYear() : "";
  const interestSaved = totalInterestSaved;
  const suggestedCount = suggestedLumpSums.length;

  if (isLoading) {
    return (
      <div className="bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted-light">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark min-h-screen flex">
      {/* ─── Sidebar ─── */}
      <AppNavigation userName={userName} />

      {/* ─── Main Content ─── */}
      <main className="flex-1 px-4 py-6 md:px-9 md:py-8 pb-24 md:pb-8 overflow-y-auto relative">
        <div>
          {/* Header */}
          <header className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">
              {userName ? `Welcome back, ${userName}` : "Your repayment overview"}
            </h1>
            <p className="text-sm md:text-lg text-text-muted-light dark:text-text-muted-dark">
              Based on your current loans and assets — updated today
            </p>
          </header>

          {/* ─── Summary Cards + AI Advisor Row ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 auto-rows-max lg:auto-rows-min">
            {/* Top Summary Cards */}
            <div className="lg:col-span-8 flex flex-col gap-4 md:gap-6">
              {/* Total Debt & Payoff Date Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                {/* Total Debt */}
                <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[20px] p-5 md:p-6 flex flex-col justify-between">
                  <div>
                    <div className="text-xs md:text-sm font-bold tracking-wider text-text-muted-light dark:text-text-muted-dark uppercase mb-2">
                      Total Debt
                    </div>
                    <div className="font-display text-3xl md:text-4xl font-bold mb-1">
                      {loanCount > 0 ? formatCurrency(totalDebt, currency) : formatCurrency(0, currency)}
                    </div>
                    <div className="text-primary font-medium text-xs md:text-sm">
                      {loanCount > 0
                        ? `Across ${loanCount} loan${loanCount !== 1 ? "s" : ""}`
                        : "No loans added yet"}
                    </div>
                  </div>
                </div>

                {/* Payoff Date — reactive */}
                <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[20px] p-5 md:p-6 flex flex-col justify-between">
                  <div>
                    <div className="text-xs md:text-sm font-bold tracking-wider text-text-muted-light dark:text-text-muted-dark uppercase mb-2">
                      Payoff Date
                    </div>
                    <div className="font-display text-3xl md:text-4xl font-bold leading-tight mb-2">
                      {payoffMonth}<br />{payoffYear}
                    </div>
                  </div>
                </div>

                {/* Interest You Can Save — reactive */}
                <div className="bg-primary rounded-[20px] p-5 md:p-6 flex flex-col justify-between text-white shadow-sm">
                  <div>
                    <div className="text-xs md:text-sm font-bold tracking-wider uppercase mb-2 opacity-90">
                      Interest Saved
                    </div>
                    <div className="font-display text-3xl md:text-4xl font-bold mb-2">
                      {formatCurrency(interestSaved, currency)}
                    </div>
                    <div className="text-xs md:text-sm font-medium opacity-90 leading-snug">
                      {suggestedCount > 0
                        ? `By applying ${suggestedCount} suggestion${suggestedCount !== 1 ? "s" : ""}`
                        : "With optimized strategy"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Advisor Sidebar — aligns with Interest You Can Save and extends down */}
            <div className="lg:col-span-4 lg:row-start-1 lg:row-span-2">
              {/* ─── AI Insight Card ─── */}
              <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[20px] p-5 md:p-6 w-full">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-terra-light dark:bg-[#4a3625] text-primary rounded-full text-xs font-bold uppercase tracking-wide mb-4 border border-border-light dark:border-[#5a422e]">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {adviceLoading ? (
                    <span className="flex items-center gap-1">
                      <RefreshCw size={12} className="animate-spin" /> Recalculating…
                    </span>
                  ) : (
                    "AI insight"
                  )}
                </div>

                {adviceLoading ? (
                  <InsightSkeleton />
                ) : advice ? (
                  <>
                    <p className="text-base md:text-lg leading-relaxed text-text-main-light dark:text-text-main-dark mb-4">
                      {advice.insight}
                    </p>

                    {advice.suggestions.length > 0 && (
                      <ul className="space-y-2 mb-6">
                        {advice.suggestions.map((s, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-text-main-light dark:text-text-main-dark"
                          >
                            <span className="mt-1 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-sm leading-relaxed">{s}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                      <button className="w-full md:w-auto bg-primary text-white h-12 md:h-10 px-6 rounded-xl text-sm md:text-base font-medium hover:bg-opacity-90 transition-opacity">
                        Apply suggestions
                      </button>
                      <button
                        onClick={fetchAdvice}
                        className="w-full md:w-auto border border-border-light dark:border-border-dark text-text-main-light dark:text-text-main-dark h-12 md:h-10 px-6 rounded-xl text-sm md:text-base font-medium hover:bg-background-light dark:hover:bg-background-dark transition-colors"
                      >
                        Refresh insight
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* ─── Bottom Grid: Loans + Chart ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-6 mt-4 md:mt-6">
            {/* Loans List — from store, with empty state */}
            <div className="md:col-span-1 lg:col-span-5 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[20px] p-5 md:p-6 w-full">
              <h3 className="text-lg md:text-xl font-medium mb-4 md:mb-6">Your loans</h3>

              {loans.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-[#f2e7da] flex items-center justify-center mx-auto mb-4">
                    <Wallet size={24} className="text-primary" />
                  </div>
                  <p className="text-text-muted-light dark:text-text-muted-dark mb-4 text-sm md:text-base">
                    No loans added yet
                  </p>
                  <Link
                    href="/loans"
                    className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 h-12 md:h-10 rounded-xl font-medium hover:bg-opacity-90 transition-opacity text-sm w-full md:w-auto"
                  >
                    <Plus size={16} />
                    Add your first loan
                  </Link>
                </div>
              ) : (
                <div className="space-y-4 md:space-y-6">
                  {loans.map((loan, idx) => {
                    const style = loanIcons[loan.type] ?? loanIcons.other;
                    const isLast = idx === loans.length - 1;
                    return (
                      <div
                        key={loan.id}
                        className={`flex items-center justify-between ${
                          !isLast
                            ? "pb-4 md:pb-6 border-b border-border-light dark:border-border-dark"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 md:gap-4">
                          <div
                            className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${style.bg} flex items-center justify-center ${style.fg}`}
                          >
                            {style.icon}
                          </div>
                          <div>
                            <div className="font-medium text-sm md:text-base">{loan.name}</div>
                            <div className="text-xs md:text-sm text-text-muted-light dark:text-text-muted-dark mt-0.5">
                              {loan.rate}% · {formatTerm(loan.termMonths)}
                            </div>
                          </div>
                        </div>
                        <div className="font-medium text-sm md:text-base">{formatCurrency(loan.balance, currency)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payoff Timeline Chart */}
            <div className="md:col-span-1 lg:col-span-7 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-[20px] p-5 md:p-6 flex flex-col w-full">
              <h3 className="text-lg md:text-xl font-medium mb-4 md:mb-6">Payoff timeline</h3>
              <div className="flex flex-wrap gap-2 mb-6 md:mb-8">
                <button className="px-3 md:px-4 py-1.5 border border-border-light dark:border-border-dark rounded-full text-xs md:text-sm font-medium hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                  Monthly
                </button>
                <button className="px-3 md:px-4 py-1.5 bg-background-light dark:bg-background-dark border border-transparent rounded-full text-xs md:text-sm font-medium">
                  Quarterly
                </button>
                <button className="px-3 md:px-4 py-1.5 border border-border-light dark:border-border-dark rounded-full text-xs md:text-sm font-medium hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                  Yearly
                </button>
              </div>

              <div className="flex-1 relative flex items-end min-h-[160px] md:min-h-[200px] mb-4 md:mb-6">
                <div className="w-full flex items-end justify-between gap-1 md:gap-2 h-full pb-6 md:pb-8 border-b border-border-light dark:border-border-dark relative">
                  <div className="absolute inset-0 flex flex-col justify-between z-0 pointer-events-none opacity-20 dark:opacity-10">
                    <div className="w-full h-px bg-text-muted-light dark:bg-text-muted-dark" />
                    <div className="w-full h-px bg-text-muted-light dark:bg-text-muted-dark" />
                    <div className="w-full h-px bg-text-muted-light dark:bg-text-muted-dark" />
                    <div className="w-full h-px bg-text-muted-light dark:bg-text-muted-dark" />
                  </div>
                  {timelineBars.map((bar, i) => (
                    <div
                      key={i}
                      className="w-1/12 bg-terra-light dark:bg-[#4a3625] rounded-t-sm md:rounded-t-md relative z-10"
                      style={{ height: `${bar.baseline}%` }}
                    >
                      <div
                        className="absolute bottom-0 w-full bg-primary rounded-t-sm md:rounded-t-md"
                        style={{ height: `${bar.optimized}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 md:gap-6 mt-auto">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-terra-light dark:bg-[#4a3625]" />
                  <span className="text-xs md:text-sm text-text-muted-light dark:text-text-muted-dark">Baseline</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-primary" />
                  <span className="text-xs md:text-sm text-text-muted-light dark:text-text-muted-dark">Optimized</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Floating Add Loan Button ─── */}
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-[88px] md:bottom-8 right-4 md:right-8 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-opacity-90 transition-all hover:scale-105 z-30"
          title="Add loan"
        >
          <Plus size={24} />
        </button>
      </main>

      {/* ─── Add Loan Drawer (from floating button) ─── */}
      <LoanFormModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddLoan}
        editingLoan={null}
      />
    </div>
  );
}
