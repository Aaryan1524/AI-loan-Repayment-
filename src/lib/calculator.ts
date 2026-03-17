/**
 * ClearDebt — Core Repayment Calculation Engine
 *
 * Pure function that simulates month-by-month loan repayment under three
 * strategies: baseline, avalanche (highest rate first), and snowball
 * (lowest balance first).
 */

import type { Loan, Asset, IncomeSource, LumpSum, Strategy } from "./store";

/* ─── Output Types ─── */

export interface MonthlyEntry {
  month: number; // 1-indexed
  date: Date;
  totalBalance: number;
  interestPaid: number;
  principalPaid: number;
  remainingBalance: number;
  loanBalances: Record<string, number>;
}

export interface SuggestedLumpSum {
  assetId: string;
  suggestedDate: string; // ISO
  amount: number;
  interestSaved: number;
}

export interface RepaymentResult {
  monthlySchedule: MonthlyEntry[];
  payoffDate: Date;
  totalInterestPaid: number;
  totalInterestSaved: number; // vs baseline with no extras
  suggestedLumpSums: SuggestedLumpSum[];
}

 // imported from store

/* ─── Helpers ─── */

/** Standard EMI formula for a fixed-term loan */
export function calculateEMI(balance: number, annualRate: number, termMonths: number): number {
  if (balance <= 0) return 0;
  if (termMonths <= 0) {
    // Revolving: minimum payment = interest + 2% of balance, floor $25
    const monthlyRate = annualRate / 100 / 12;
    return Math.max(balance * monthlyRate + balance * 0.02, 25);
  }
  const r = annualRate / 100 / 12;
  if (r === 0) return balance / termMonths;
  return (balance * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

/** Advance a Date by one month */
function addMonth(d: Date): Date {
  const next = new Date(d);
  next.setMonth(next.getMonth() + 1);
  return next;
}

/** Format Date → "YYYY-MM" for comparison with lump-sum dates */
function toYearMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/* ─── Internal loan state used during simulation ─── */
interface LoanState {
  id: string;
  name: string;
  balance: number;
  rate: number; // annual %
  termMonths: number;
  emi: number;
}

/* ─── Core Simulation ─── */

function simulate(
  loans: Loan[],
  incomeSources: IncomeSource[],
  lumpSums: LumpSum[],
  strategy: Strategy,
  applyExtras: boolean,
  extraMonthlyPayment: number = 0,
  customOrder?: string[]
): { schedule: MonthlyEntry[]; totalInterest: number } {
  // Deep-clone loan states
  const states: LoanState[] = loans.map((l) => ({
    id: l.id,
    name: l.name,
    balance: l.balance,
    rate: l.rate,
    termMonths: l.termMonths,
    emi: l.emiOverride || (l.termMonths === 0 ? calculateEMI(l.balance, l.rate, 0) : calculateEMI(l.principal, l.rate, l.termMonths)),
  }));

  const totalMonthlyIncome = incomeSources.reduce((s, i) => s + i.monthlyAmount, 0);

  // Index lump sums by year-month for O(1) lookup
  const lumpSumMap = new Map<string, number>();
  let immediateLumpSum = 0; // Everything <= current month
  
  // Normalise to 1st of current month
  let currentDate = new Date();
  currentDate.setDate(1); 
  currentDate.setHours(0, 0, 0, 0);
  const currentYM = toYearMonth(currentDate);

  if (applyExtras) {
    for (const ls of lumpSums) {
      const ym = ls.date.substring(0, 7); // "YYYY-MM"
      if (ym <= currentYM) {
        immediateLumpSum += ls.amount;
      } else {
        lumpSumMap.set(ym, (lumpSumMap.get(ym) ?? 0) + ls.amount);
      }
    }
  }

  const schedule: MonthlyEntry[] = [];
  let totalInterest = 0;

  const MAX_MONTHS = 600; // safety cap: 50 years

  for (let month = 1; month <= MAX_MONTHS; month++) {
    currentDate = addMonth(currentDate);

    // Check if all loans paid off
    const activeLoans = states.filter((l) => l.balance > 0);
    if (activeLoans.length === 0) break;

    let monthInterest = 0;
    let monthPrincipal = 0;

    // 1. Compute minimum EMIs and interest for each active loan
    const totalMinEMI = activeLoans.reduce((sum, l) => sum + l.emi, 0);

    for (const loan of activeLoans) {
      const monthlyRate = loan.rate / 100 / 12;
      const interest = loan.balance * monthlyRate;
      const principalFromEMI = Math.min(loan.emi - interest, loan.balance);
      const actualInterest = Math.min(interest, loan.balance);

      loan.balance -= principalFromEMI;
      if (loan.balance < 0.01) loan.balance = 0;

      monthInterest += actualInterest;
      monthPrincipal += principalFromEMI;
    }

    // 2. Compute surplus = income - total minimum EMIs
    let surplus = 0;
    if (applyExtras) {
      surplus = Math.max(0, totalMonthlyIncome - totalMinEMI) + extraMonthlyPayment;
      
      // 3. Add lump sum injections for this month (and immediate ones in month 1)
      if (month === 1) {
        surplus += immediateLumpSum;
      }
      const ym = toYearMonth(currentDate);
      if (lumpSumMap.has(ym)) {
        surplus += lumpSumMap.get(ym)!;
      }
    }

    // 4. Distribute surplus based on strategy
    if (surplus > 0 && strategy !== "baseline") {
      const prioritised = [...states].filter((l) => l.balance > 0);

      if (strategy === "custom" && customOrder) {
        prioritised.sort((a, b) => {
          const idxA = customOrder.indexOf(a.id);
          const idxB = customOrder.indexOf(b.id);
          // If not in customOrder (shouldnt happen but safety fallback), push to end
          return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        });
      } else if (strategy === "avalanche") {
        prioritised.sort((a, b) => b.rate - a.rate);
      } else if (strategy === "snowball") {
        prioritised.sort((a, b) => a.balance - b.balance);
      }

      let remaining = surplus;
      for (const loan of prioritised) {
        if (remaining <= 0) break;
        const payment = Math.min(remaining, loan.balance);
        loan.balance -= payment;
        if (loan.balance < 0.01) loan.balance = 0;
        monthPrincipal += payment;
        remaining -= payment;
      }
    }

    totalInterest += monthInterest;

    const totalBalance = states.reduce((s, l) => s + l.balance, 0);
    const balancesRecord: Record<string, number> = {};
    states.forEach((l) => {
      balancesRecord[l.id] = parseFloat(l.balance.toFixed(2));
    });

    schedule.push({
      month,
      date: new Date(currentDate),
      totalBalance: Math.round(totalBalance * 100) / 100,
      interestPaid: Math.round(monthInterest * 100) / 100,
      principalPaid: Math.round(monthPrincipal * 100) / 100,
      remainingBalance: Math.round(totalBalance * 100) / 100,
      loanBalances: balancesRecord,
    });

    if (totalBalance < 0.01) break;
  }

  return { schedule, totalInterest: Math.round(totalInterest * 100) / 100 };
}

/* ─── Suggested Lump Sums ─── */

function computeSuggestedLumpSums(
  loans: Loan[],
  assets: Asset[],
  incomeSources: IncomeSource[],
  lumpSums: LumpSum[]
): SuggestedLumpSum[] {
  const suggestions: SuggestedLumpSum[] = [];

  // Run a baseline simulation (no extras) to get baseline interest
  const baseline = simulate(loans, incomeSources, [], "baseline", false);

  for (const asset of assets) {
    if (!asset.maturityDate) continue;

    // Find the highest-rate loan — if the asset return < that rate, suggest redirect
    const highestRateLoan = [...loans]
      .filter((l) => l.balance > 0)
      .sort((a, b) => b.rate - a.rate)[0];

    if (!highestRateLoan || asset.returnRate >= highestRateLoan.rate) continue;

    // Simulate with this asset as a lump sum
    const hypotheticalLumpSum: LumpSum = {
      id: `suggested-${asset.id}`,
      date: asset.maturityDate,
      amount: asset.value,
      label: `Redirect ${asset.name}`,
    };

    const withLumpSum = simulate(
      loans,
      incomeSources,
      [...lumpSums, hypotheticalLumpSum],
      "avalanche",
      true
    );

    const interestSaved = baseline.totalInterest - withLumpSum.totalInterest;
    if (interestSaved > 0) {
      suggestions.push({
        assetId: asset.id,
        suggestedDate: asset.maturityDate,
        amount: asset.value,
        interestSaved: Math.round(interestSaved * 100) / 100,
      });
    }
  }

  return suggestions;
}

/* ─── Public API ─── */

export function calculateRepayment(
  loans: Loan[],
  assets: Asset[],
  incomeSources: IncomeSource[],
  lumpSums: LumpSum[],
  strategy: Strategy,
  customOrder?: string[],
  extraMonthlyPayment: number = 0
): RepaymentResult {
  // 1. Filter out irregular income (e.g. freelance) and non-repay income from stable monthly surplus calculation
  const regularIncome = incomeSources.filter((i) => !i.isIrregular && (i.useToRepay ?? true));

  // 2. Convert earmarked assets into dynamic lump sums
  const assetLumpSums: LumpSum[] = assets
    .filter((a) => a.useToRepay)
    .map((a) => {
      let amount = a.value;
      let dateStr = a.maturityDate;

      if (!dateStr) {
        // Liquid assets (no maturity) apply immediately
        dateStr = new Date().toISOString().split("T")[0];
      } else {
        // Project value to maturity date based on returnRate
        const maturity = new Date(dateStr);
        const today = new Date();
        const months =
          (maturity.getFullYear() - today.getFullYear()) * 12 +
          (maturity.getMonth() - today.getMonth());

        if (months > 0 && a.returnRate > 0) {
          amount = a.value * Math.pow(1 + a.returnRate / 100 / 12, months);
        }
      }

      return {
        id: `earmarked-${a.id}`,
        date: dateStr,
        amount: Math.round(amount),
        label: `Earmarked: ${a.name}`,
      };
    });

  const allLumpSums = [...lumpSums, ...assetLumpSums];

  // 3. True Baseline: minimum EMIs only, no extras
  const baseline = simulate(loans, regularIncome, [], "baseline", false);

  // 4. Active strategy: applies regular income surplus + all lump sums + extra monthly
  const active = simulate(
    loans,
    regularIncome,
    allLumpSums,
    strategy,
    strategy !== "baseline",
    extraMonthlyPayment,
    customOrder
  );

  // 5. AI Suggestions: Only suggest non-earmarked assets
  const nonEarmarkedAssets = assets.filter((a) => !a.useToRepay);
  const suggestedLumpSums = computeSuggestedLumpSums(loans, nonEarmarkedAssets, regularIncome, allLumpSums);

  const lastEntry = active.schedule[active.schedule.length - 1];
  const payoffDate = lastEntry ? lastEntry.date : new Date();

  return {
    monthlySchedule: active.schedule,
    payoffDate,
    totalInterestPaid: active.totalInterest,
    totalInterestSaved: Math.round((baseline.totalInterest - active.totalInterest) * 100) / 100,
    suggestedLumpSums,
  };
}
