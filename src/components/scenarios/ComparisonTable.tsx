"use client";

import { useEffect, useState } from "react";
import type { Scenario } from "@/lib/store";
import type { RepaymentResult } from "@/lib/calculator";
import { useAppStore } from "@/lib/store";
import { formatCurrency, type CurrencyCode } from "@/lib/formatCurrency";

interface Props {
  scenarios: Scenario[];
  results: Record<string, RepaymentResult>;
  baselineId: string;
}

function AnimatedNumber({ value, isMonths = false, currency = "USD" }: { value: number; isMonths?: boolean; currency?: CurrencyCode }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let startTimestamp: number;
    const duration = 1200;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * easeProgress);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplay(value);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  if (isMonths) {
    return <span>{Math.round(display)}</span>;
  }
  return <span>{formatCurrency(display, currency)}</span>;
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

export function ComparisonTable({ scenarios, results, baselineId }: Props) {
  const currency = useAppStore((s) => s.currency);

  if (!scenarios.length || Object.keys(results).length === 0) return null;

  const baselineResult = results[baselineId] || results[scenarios[0].id];

  // Helper metrics per scenario
  interface Metric {
    id: string;
    payoffDate: Date;
    monthsTaken: number;
    totalInterest: number;
    interestSaved: number;
    monthsSaved: number;
    monthlyPayment: number;
    netWorthImpactPerYear: number;
  }

  const metrics: Metric[] = scenarios.map((sc) => {
    const res = results[sc.id];
    if (!res) return null;
    
    const monthsTaken = res.monthlySchedule.length;
    const baselineMonths = baselineResult.monthlySchedule.length;
    
    const totalInterest = res.totalInterestPaid;
    const interestSaved = baselineResult.totalInterestPaid - totalInterest;
    const monthsSaved = baselineMonths - monthsTaken;
    
    const firstMonth = res.monthlySchedule[0];
    const initialMonthlyPayment = firstMonth ? firstMonth.interestPaid + firstMonth.principalPaid : 0;
    
    // Total debt initially
    const totalDebt = res.monthlySchedule[0]?.totalBalance || 0;
    const netWorthImpactPerYear = monthsTaken > 0 ? (totalDebt / (monthsTaken / 12)) : 0;

    return {
      id: sc.id,
      payoffDate: res.payoffDate,
      monthsTaken,
      totalInterest,
      interestSaved: Math.max(0, interestSaved),
      monthsSaved: Math.max(0, monthsSaved),
      monthlyPayment: initialMonthlyPayment,
      netWorthImpactPerYear,
    };
  }).filter((m): m is Metric => m !== null);

  // Find bests for highlighting
  let minInterest = Infinity;
  let minDate = new Date(8640000000000000); // Max future date
  let maxInterestSaved = -1;
  let maxMonthsSaved = -1;
  let maxNetWorthImpact = -1;

  metrics.forEach((m) => {
    if (m.totalInterest < minInterest) minInterest = m.totalInterest;
    if (m.payoffDate < minDate) minDate = m.payoffDate;
    if (m.interestSaved > maxInterestSaved) maxInterestSaved = m.interestSaved;
    if (m.monthsSaved > maxMonthsSaved) maxMonthsSaved = m.monthsSaved;
    if (m.netWorthImpactPerYear > maxNetWorthImpact) maxNetWorthImpact = m.netWorthImpactPerYear;
  });

  return (
    <div className="w-full overflow-x-auto bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark mt-8 shadow-sm">
      <table className="w-full text-left border-collapse min-w-[600px]">
        <thead>
          <tr>
            <th className="p-4 border-b border-border-light dark:border-border-dark text-text-muted-light dark:text-text-muted-dark font-medium bg-background-light/50 dark:bg-background-dark/50">
              Metric
            </th>
            {scenarios.map((sc) => (
              <th
                key={sc.id}
                className="p-4 border-b border-l border-border-light dark:border-border-dark font-display font-medium text-text-main-light dark:text-text-main-dark text-center bg-background-light/50 dark:bg-background-dark/50"
              >
                {sc.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Row: Payoff Date */}
          <tr>
            <td className="p-4 py-5 border-b border-border-light dark:border-border-dark text-sm text-text-muted-light dark:text-text-muted-dark">
              Payoff Date
            </td>
            {metrics.map((m) => {
              const matches = m.payoffDate.getTime() === minDate.getTime();
              return (
                <td
                  key={`payoff-${m.id}`}
                  className={`p-4 py-5 border-b border-l border-border-light dark:border-border-dark text-center font-semibold ${
                    matches ? "bg-sage/10 text-sage" : "text-text-main-light dark:text-text-main-dark"
                  }`}
                >
                  {formatDate(m.payoffDate)}
                </td>
              );
            })}
          </tr>

          {/* Row: Total Interest Paid */}
          <tr>
            <td className="p-4 py-5 border-b border-border-light dark:border-border-dark text-sm text-text-muted-light dark:text-text-muted-dark">
              Total Interest Paid
            </td>
            {metrics.map((m) => {
              const matches = m.totalInterest === minInterest;
              return (
                <td
                  key={`int-${m.id}`}
                  className={`p-4 py-5 border-b border-l border-border-light dark:border-border-dark text-center font-semibold ${
                    matches ? "bg-sage/10 text-sage" : "text-text-main-light dark:text-text-main-dark"
                  }`}
                >
                  {formatCurrency(m.totalInterest, currency)}
                </td>
              );
            })}
          </tr>

          {/* Row: Interest Saved vs Baseline */}
          <tr>
            <td className="p-4 py-5 border-b border-border-light dark:border-border-dark text-sm text-text-muted-light dark:text-text-muted-dark">
              Interest Saved <span className="text-xs opacity-60">(vs Baseline)</span>
            </td>
            {metrics.map((m) => {
              const isBest = m.interestSaved === maxInterestSaved && m.interestSaved > 0;
              return (
                <td
                  key={`avg-${m.id}`}
                  className={`p-4 py-5 border-b border-l border-border-light dark:border-border-dark text-center font-semibold ${
                    isBest ? "bg-sage/10 text-sage" : m.interestSaved > 0 ? "text-sage" : "text-text-muted-light dark:text-text-muted-dark"
                  }`}
                >
                  {m.interestSaved > 0 ? "+" : ""}<AnimatedNumber value={m.interestSaved} currency={currency} />
                </td>
              );
            })}
          </tr>

          {/* Row: Months Saved vs Baseline */}
          <tr>
            <td className="p-4 py-5 border-b border-border-light dark:border-border-dark text-sm text-text-muted-light dark:text-text-muted-dark">
              Months Saved <span className="text-xs opacity-60">(vs Baseline)</span>
            </td>
            {metrics.map((m) => {
              const isBest = m.monthsSaved === maxMonthsSaved && m.monthsSaved > 0;
              return (
                <td
                  key={`mons-${m.id}`}
                  className={`p-4 py-5 border-b border-l border-border-light dark:border-border-dark text-center font-semibold ${
                    isBest ? "bg-sage/10 text-sage" : m.monthsSaved > 0 ? "text-sage" : "text-text-muted-light dark:text-text-muted-dark"
                  }`}
                >
                  {m.monthsSaved > 0 ? "+" : ""}<AnimatedNumber value={m.monthsSaved} isMonths currency={currency} /> months
                </td>
              );
            })}
          </tr>

          {/* Row: Initial Monthly Payment */}
          <tr>
            <td className="p-4 py-5 border-b border-border-light dark:border-border-dark text-sm text-text-muted-light dark:text-text-muted-dark">
              Initial Monthly Payment
            </td>
            {metrics.map((m) => (
              <td
                key={`pmt-${m.id}`}
                className="p-4 py-5 border-b border-l border-border-light dark:border-border-dark text-center font-semibold text-text-main-light dark:text-text-main-dark"
              >
                {formatCurrency(m.monthlyPayment, currency)} /mo
              </td>
            ))}
          </tr>

          {/* Row: Net Worth Impact */}
          <tr>
            <td className="p-4 py-5 border-border-light dark:border-border-dark text-sm text-text-muted-light dark:text-text-muted-dark">
              Net Worth Impact <span className="text-xs opacity-60">(Debt Reduced / Yr)</span>
            </td>
            {metrics.map((m) => {
              const isBest = m.netWorthImpactPerYear === maxNetWorthImpact && m.netWorthImpactPerYear > 0;
              return (
                <td
                  key={`nwi-${m.id}`}
                  className={`p-4 py-5 border-l border-border-light dark:border-border-dark text-center font-semibold ${
                    isBest ? "bg-sage/10 text-sage" : "text-text-main-light dark:text-text-main-dark"
                  }`}
                >
                  {formatCurrency(m.netWorthImpactPerYear, currency)} /yr
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
