"use client";

import { useState, useEffect } from "react";
import AppNavigation from "../../components/layout/AppNavigation";
import Link from "next/link";
import {
  BarChart3,
  Printer,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { calculateEMI } from "@/lib/calculator";
import { useFinancialData } from "@/hooks/useFinancialData";
import { formatCurrency, formatAxisTick } from "@/lib/formatCurrency";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";



/* ─── Color Palette for Charts ─── */
const COLORS = {
  sage: "#6B8F6A",
  terracottaLight: "#D99A7A",
  terracotta: "#C17B4A",
  sand: "#E5DCC5",
  midnight: "#1E293B",
  loanTypes: {
    mortgage: "#6B8F6A",
    student: "#5A607C",
    car: "#C17B4A",
    credit: "#D99A7A",
    other: "#94A3B8",
  },
};

export default function AnalyticsPage() {
  const {
    loans, assets, incomeSources,
    calcResult: result, totalInterestSaved,
    isLoading,
  } = useFinancialData();
  const currency = useAppStore((s) => s.currency);
  const [isClient, setIsClient] = useState(false);
  const [waterfallPeriod, setWaterfallPeriod] = useState<"Monthly" | "Quarterly" | "Yearly">("Yearly");
  const [aiInsight, setAiInsight] = useState<{ insight: string; suggestions: string[] } | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch AI insight for print view
  useEffect(() => {
    async function fetchAiPrintInsight() {
      try {
        const payload = {
          loans,
          assets,
          payoffDate: result?.payoffDate?.toISOString() ?? "2030-01-01",
          totalInterestSaved,
        };
        const res = await fetch("/api/advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setAiInsight(data);
        }
      } catch (e) {
        console.error("Print AI fetch error", e);
      }
    }
    if (loans.length > 0) fetchAiPrintInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted-light">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!isClient) return null; // Hydration guard

  if (!result || loans.length === 0) {
    return (
      <div className="bg-background-light dark:bg-background-dark min-h-screen flex">
        {/* Basic sidebar for empty state */}
        <AppNavigation />
        <main className="flex-1 p-10 flex flex-col items-center justify-center text-center">
          <BarChart3 size={48} className="text-text-muted-light mb-4 opacity-50" />
          <h2 className="text-xl font-display font-semibold text-text-main-light mb-2">No Data Available</h2>
          <p className="text-text-muted-light max-w-sm mb-6">
            Add some loans and income sources first to see your analytics.
          </p>
          <Link href="/loans" className="bg-primary text-white px-6 py-2 rounded-xl font-medium shadow-sm hover:hover:bg-primary/90">
            Go to My Loans
          </Link>
        </main>
      </div>
    );
  }

  /* ─── Chart 1 Data: Amortization ─── */
  let cumulativeInterest = 0;
  let cumulativePrincipal = 0;
  const chart1Data = result.monthlySchedule.map((m) => {
    cumulativeInterest += m.interestPaid;
    cumulativePrincipal += m.principalPaid;
    return {
      monthLabel: m.date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      unixTimestamp: m.date.getTime(),
      principalPaid: cumulativePrincipal,
      interestPaid: cumulativeInterest,
      remainingBalance: m.remainingBalance,
    };
  });
  const todayTimestamp = new Date().getTime();

  /* ─── Chart 2 Data: Debt Waterfall ─── */
  // Group by Monthly, Quarterly (mod 3), or Yearly (mod 12)
  const intervalMap: Record<string, number> = { Monthly: 1, Quarterly: 3, Yearly: 12 };
  const interval = intervalMap[waterfallPeriod];
  const chart2Data = result.monthlySchedule.filter((m) => (m.month - 1) % interval === 0).map((m) => {
    const dataPoint: Record<string, string | number> = { monthLabel: m.date.toLocaleDateString("en-US", { month: "short", year: "numeric" }) };
    loans.forEach((loan) => {
      dataPoint[loan.id] = m.loanBalances[loan.id] || 0;
    });
    return dataPoint;
  });

  /* ─── Chart 3 Data: Asset vs Loan Crossover ─── */
  // Project asset growth month by month
  // Assets: Mutual funds (returnRate, SIP), Stocks (returnRate), Cash, FDs
  const chart3Data = [];
  let currentAssetsValue = assets.reduce((sum, a) => sum + (a.type !== "fd" ? a.value : 0), 0);
  const totalSip = assets.reduce((sum, a) => sum + (a.sipAmount || 0), 0);
  let crossoverDate = "";

  for (let i = 0; i < result.monthlySchedule.length; i++) {
    const m = result.monthlySchedule[i];
    
    // Growth step for liquid assets (simplified annual matching)
    const avgReturn = assets.length > 0 ? assets.reduce((s, a) => s + (a.returnRate || 0), 0) / assets.length : 0;
    const monthlyReturn = avgReturn / 100 / 12;
    currentAssetsValue = currentAssetsValue * (1 + monthlyReturn) + totalSip;

    // Check FDs maturity
    assets.filter((a) => a.type === "fd" && a.maturityDate).forEach((fd) => {
      const maturity = new Date(fd.maturityDate!);
      if (m.date.getMonth() === maturity.getMonth() && m.date.getFullYear() === maturity.getFullYear()) {
        const termYears = (maturity.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        const finalValue = fd.value * Math.pow(1 + fd.returnRate / 100, termYears > 0 ? termYears : 1);
        currentAssetsValue += finalValue;
      }
    });

    const isCrossover = currentAssetsValue >= m.remainingBalance && crossoverDate === "";
    if (isCrossover) {
      crossoverDate = m.date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }

    chart3Data.push({
      monthLabel: m.date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      totalAssets: currentAssetsValue,
      totalLoans: m.remainingBalance,
    });
  }

  /* ─── Chart 4 Data: Cash Flow ─── */
  // Use hook's totalMonthlyEMI for consistency
  const totalMinEMI = loans.reduce((sum: number, l: any) => {
    if (l.balance <= 0) return sum;
    if (l.emiOverride) return sum + l.emiOverride;
    if (l.termMonths === 0) return sum + calculateEMI(l.balance, l.rate, 0);
    return sum + calculateEMI(l.principal, l.rate, l.termMonths);
  }, 0);
  const totalMonthlyIncome = incomeSources
    .filter((inc: { isIrregular?: boolean }) => !inc.isIrregular)
    .reduce((sum: number, inc: { monthlyAmount: number }) => sum + inc.monthlyAmount, 0);

  const chart4Data = result.monthlySchedule.slice(0, 12).map((m) => {
    // Principal paid contains minimum EMI principal + extra principal
    // Interest paid is part of minimum EMI
    // Reconstruct the logic backwards:
    const totalPaymentThisMonth = m.interestPaid + m.principalPaid;
    const extraPayment = Math.max(0, totalPaymentThisMonth - totalMinEMI);
    const standardEMI = Math.min(totalPaymentThisMonth, totalMinEMI);
    const surplusRemaining = Math.max(0, totalMonthlyIncome - totalPaymentThisMonth);

    return {
      monthLabel: m.date.toLocaleDateString("en-US", { month: "short" }),
      StandardEMI: standardEMI,
      ExtraPayments: extraPayment,
      Surplus: surplusRemaining,
    };
  });

  // Calculate stats for print view
  const activeTotalDebt = result.monthlySchedule[0]?.totalBalance || 0;
  const payoffDateStr = result.payoffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-background-light text-text-main-light min-h-screen flex">
      {/* ─── Print Styles ─── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white; color: black; }
          aside, header, button.no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
          .print-header { display: block !important; margin-bottom: 2rem; }
          .print-stat-cards { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
          .print-ai { display: block !important; border: 1px solid #e2e8f0; padding: 1.5rem; border-radius: 0.5rem; margin-bottom: 2rem; page-break-inside: avoid; }
          .chart-card { border: none !important; box-shadow: none !important; page-break-inside: avoid; margin-bottom: 2rem !important; }
          .recharts-wrapper { background: transparent !important; }
        }
      `}} />

      {/* ─── Sidebar ─── */}
      <AppNavigation />

      {/* ─── Main Content ─── */}
      <main className="flex-1 p-10 overflow-y-auto max-w-[1200px]">
        {/* Screen Header */}
        <div className="no-print flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-semibold mb-2 text-text-main-light">
              Analytics & Insights
            </h1>
            <p className="text-text-muted-light">
              Deep dive into your repayment projections and cash flow distribution.
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white border border-border-light text-text-main-light px-5 py-2.5 rounded-xl font-medium hover:bg-surface-light shadow-sm transition-colors"
          >
            <Printer size={18} />
            Export Report
          </button>
        </div>

        {/* Print Only Header */}
        <div className="hidden print-header">
          <h1 className="text-4xl font-display font-bold mb-2">ClearDebt Financial Report</h1>
          <p className="text-text-muted-light mb-8">Generated on {new Date().toLocaleDateString()}</p>

          {/* Print Stat Cards */}
          <div className="print-stat-cards hidden">
            <div className="p-4 border border-border-light rounded-xl">
              <div className="text-sm text-text-muted-light mb-1">Total Debt</div>
              <div className="text-2xl font-semibold">{formatCurrency(activeTotalDebt, currency)}</div>
            </div>
            <div className="p-4 border border-border-light rounded-xl">
              <div className="text-sm text-text-muted-light mb-1">Payoff Date</div>
              <div className="text-2xl font-semibold text-primary">{payoffDateStr}</div>
            </div>
            <div className="p-4 border border-border-light rounded-xl">
              <div className="text-sm text-text-muted-light mb-1">Interest Saved</div>
              <div className="text-2xl font-semibold text-sage">{formatCurrency(result.totalInterestSaved, currency)}</div>
            </div>
          </div>

          {/* Print AI Insight */}
          {aiInsight && (
            <div className="print-ai hidden">
              <div className="flex items-center gap-2 mb-3 text-primary">
                <Sparkles size={20} />
                <h3 className="font-semibold text-lg">AI Advisor Insight</h3>
              </div>
              <p className="mb-4 text-text-main-light">{aiInsight.insight}</p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-text-muted-light">
                {aiInsight.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CHART 1: Amortization Breakdown (Full Width) */}
          <div className="chart-card lg:col-span-2 bg-white border border-border-light rounded-2xl p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="text-xl font-display font-medium text-text-main-light">Amortization Breakdown</h3>
              <p className="text-sm text-text-muted-light">Cumulative principal vs interest paid over time.</p>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer>
                <AreaChart data={chart1Data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} minTickGap={30} />
                  <YAxis tickFormatter={(val: number) => formatAxisTick(val, currency)} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value), currency)}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <ReferenceLine x={chart1Data.find(d => d.unixTimestamp > todayTimestamp)?.monthLabel || chart1Data[0]?.monthLabel} stroke={COLORS.midnight} strokeDasharray="3 3" label={{ position: 'top', value: 'Today', fill: COLORS.midnight, fontSize: 12 }} />
                  <Area type="monotone" dataKey="principalPaid" name="Principal Paid" stackId="1" stroke={COLORS.sage} fill={COLORS.sage} fillOpacity={0.8} />
                  <Area type="monotone" dataKey="interestPaid" name="Interest Paid" stackId="1" stroke={COLORS.terracottaLight} fill={COLORS.terracottaLight} fillOpacity={0.8} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 2: Debt Payoff Waterfall */}
          <div className="chart-card bg-white border border-border-light rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-display font-medium text-text-main-light">Debt Waterfall</h3>
                <p className="text-sm text-text-muted-light">Loan balances reducing over time.</p>
              </div>
              <div className="no-print flex bg-surface-light rounded-lg p-1">
                {(["Monthly", "Quarterly", "Yearly"] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setWaterfallPeriod(period)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      waterfallPeriod === period ? "bg-white shadow-sm text-text-main-light" : "text-text-muted-light hover:text-text-main-light"
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer>
                <BarChart data={chart2Data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} minTickGap={20} />
                  <YAxis tickFormatter={(val: number) => formatAxisTick(val, currency)} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value), currency)}
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  {loans.map((loan) => (
                    <Bar key={loan.id} dataKey={loan.id} name={loan.name} stackId="a" fill={COLORS.loanTypes[loan.type as keyof typeof COLORS.loanTypes] || COLORS.loanTypes.other} radius={[4, 4, 4, 4]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 3: Asset Growth vs Loan Balance */}
          <div className="chart-card bg-white border border-border-light rounded-2xl p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="text-xl font-display font-medium text-text-main-light">Assets vs Debt</h3>
              <p className="text-sm text-text-muted-light">When will your net worth go positive?</p>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer>
                <LineChart data={chart3Data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} minTickGap={30} />
                  <YAxis tickFormatter={(val: number) => formatAxisTick(val, currency)} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value), currency)}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, marginTop: 10 }} />
                  {crossoverDate && (
                    <ReferenceLine x={crossoverDate} stroke={COLORS.terracotta} strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: `Debt-Free: ${crossoverDate}`, fill: COLORS.terracotta, fontSize: 12 }} />
                  )}
                  <Line type="monotone" dataKey="totalAssets" name="Total Assets" stroke={COLORS.sage} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="totalLoans" name="Total Debt" stroke={COLORS.terracottaLight} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 4: Monthly Cash Flow */}
          <div className="chart-card lg:col-span-2 bg-white border border-border-light rounded-2xl p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="text-xl font-display font-medium text-text-main-light">12-Month Cash Flow</h3>
              <p className="text-sm text-text-muted-light">How your regular monthly income will be distributed.</p>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer>
                <BarChart data={chart4Data} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tickFormatter={(val: number) => formatAxisTick(val, currency)} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                  <YAxis type="category" dataKey="monthLabel" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#1E293B', fontWeight: 500 }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value), currency)}
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, marginTop: 10 }} />
                  <Bar dataKey="StandardEMI" name="Minimum EMIs" stackId="a" fill={COLORS.terracotta} radius={[0, 0, 0, 0]} barSize={20} />
                  <Bar dataKey="ExtraPayments" name="Extra Debt Payments" stackId="a" fill={COLORS.terracottaLight} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Surplus" name="Remaining Surplus" stackId="a" fill={COLORS.sage} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
