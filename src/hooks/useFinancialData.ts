"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { Scenario } from "@/lib/store";
import {
  calculateRepayment,
  calculateEMI,
  type RepaymentResult,
  type MonthlyEntry,
  type SuggestedLumpSum,
} from "@/lib/calculator";

/* ─── Return Type ─── */
export interface FinancialData {
  /* Raw store data */
  loans: ReturnType<typeof useAppStore.getState>["loans"];
  assets: ReturnType<typeof useAppStore.getState>["assets"];
  incomeSources: ReturnType<typeof useAppStore.getState>["incomeSources"];
  scenarios: Scenario[];
  activeScenario: string;

  /* Derived calculations — one source of truth */
  totalDebt: number;
  totalMonthlyEMI: number;
  totalMonthlyIncome: number;
  monthlySurplus: number;
  payoffDate: Date | null;
  totalInterestPaid: number;
  totalInterestSaved: number;
  monthsShortened: number;
  monthlySchedule: MonthlyEntry[];
  suggestedLumpSums: SuggestedLumpSum[];

  /* Loading / hydration */
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  /* The full result object for pages that need it */
  calcResult: RepaymentResult | null;

  /* Resolved scenario */
  resolvedScenario: Scenario | null;
}

/**
 * Single hook that reads all financial data from Zustand,
 * runs the calculator reactively, and returns one unified object.
 *
 * Every page should use this instead of computing locally.
 */
export function useFinancialData(): FinancialData {
  const loans = useAppStore((s) => s.loans);
  const assets = useAppStore((s) => s.assets);
  const incomeSources = useAppStore((s) => s.incomeSources);
  const scenarios = useAppStore((s) => s.scenarios);
  const activeScenario = useAppStore((s) => s.activeScenario);
  const isLoading = useAppStore((s) => s.isLoading);
  const isHydrated = useAppStore((s) => s.isHydrated);

  /* ─── Resolve active scenario object ─── */
  const resolvedScenario = useMemo(() => {
    let scenario = scenarios.find((s) => s.id === activeScenario);
    if (!scenario) scenario = scenarios.find((s) => s.strategy === "baseline");
    if (!scenario) scenario = scenarios[0] ?? null;
    return scenario ?? null;
  }, [scenarios, activeScenario]);

  /* ─── Core calculation — reactive on every change ─── */
  const calcResult = useMemo<RepaymentResult | null>(() => {
    if (loans.length === 0) return null;

    const strategy = resolvedScenario?.strategy ?? "avalanche";
    const lumpSums = resolvedScenario?.lumpSums ?? [];
    const customOrder = resolvedScenario?.customOrder;
    const extraMonthlyPayment = resolvedScenario?.extraMonthlyPayment ?? 0;

    return calculateRepayment(
      loans,
      assets,
      incomeSources,
      lumpSums,
      strategy,
      customOrder,
      extraMonthlyPayment
    );
  }, [loans, assets, incomeSources, resolvedScenario]);

  /* ─── Derived totals ─── */
  const totalDebt = useMemo(
    () => loans.reduce((sum, l) => sum + l.balance, 0),
    [loans]
  );

  const totalMonthlyEMI = useMemo(
    () =>
      loans.reduce((sum, l) => {
        // A loan with no balance should not have an ongoing EMI obligation
        if (l.balance <= 0) return sum;

        if (l.emiOverride) return sum + l.emiOverride;
        if (l.termMonths === 0) return sum + calculateEMI(l.balance, l.rate, 0);
        return sum + calculateEMI(l.principal, l.rate, l.termMonths);
      }, 0),
    [loans]
  );

  const totalMonthlyIncome = useMemo(
    () => incomeSources.reduce((sum, s) => sum + s.monthlyAmount, 0),
    [incomeSources]
  );

  const monthlySurplus = totalMonthlyIncome - totalMonthlyEMI;

  const payoffDate = calcResult?.payoffDate ?? (loans.length > 0 ? new Date() : null);
  const totalInterestPaid = calcResult?.totalInterestPaid ?? 0;
  const totalInterestSaved = calcResult?.totalInterestSaved ?? 0;
  const monthlySchedule = calcResult?.monthlySchedule ?? [];
  const suggestedLumpSums = calcResult?.suggestedLumpSums ?? [];

  /* Months shortened vs baseline (baseline has no extras, so its schedule is longer) */
  const monthsShortened = useMemo(() => {
    if (!calcResult || loans.length === 0) return 0;
    // Run baseline for comparison
    const baseline = calculateRepayment(loans, assets, incomeSources, [], "baseline");
    const baselineMonths = baseline.monthlySchedule.length;
    const activeMonths = calcResult.monthlySchedule.length;
    return Math.max(0, baselineMonths - activeMonths);
  }, [calcResult, loans, assets, incomeSources]);

  return {
    loans,
    assets,
    incomeSources,
    scenarios,
    activeScenario,
    totalDebt,
    totalMonthlyEMI,
    totalMonthlyIncome,
    monthlySurplus,
    payoffDate,
    totalInterestPaid,
    totalInterestSaved,
    monthsShortened,
    monthlySchedule,
    suggestedLumpSums,
    isLoading,
    isHydrated,
    error: null,
    calcResult,
    resolvedScenario,
  };
}
