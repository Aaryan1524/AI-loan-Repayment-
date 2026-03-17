"use client";

import { useState } from "react";
import { CheckCircle2, Pencil, Trash2, Calendar, DollarSign, Target, Check } from "lucide-react";
import type { Scenario } from "@/lib/store";
import type { RepaymentResult } from "@/lib/calculator";
import { useAppStore } from "@/lib/store";
import { formatCurrency } from "@/lib/formatCurrency";

interface Props {
  scenario: Scenario;
  isActive: boolean;
  result: RepaymentResult;
  onMakeActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

export function ScenarioCard({
  scenario,
  isActive,
  result,
  onMakeActive,
  onEdit,
  onDelete,
  onRename,
}: Props) {
  const currency = useAppStore((s) => s.currency);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(scenario.name);

  const handleSaveName = () => {
    if (tempName.trim() && tempName !== scenario.name) {
      onRename(tempName.trim());
    } else {
      setTempName(scenario.name);
    }
    setIsEditingName(false);
  };

  const getStrategyBadge = (s: string) => {
    switch (s) {
      case "baseline":
        return <span className="px-2.5 py-1 rounded bg-border-light/50 text-text-muted-light dark:bg-border-dark dark:text-text-muted-dark text-xs font-semibold uppercase tracking-wider">Baseline</span>;
      case "avalanche":
        return <span className="px-2.5 py-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 text-xs font-semibold uppercase tracking-wider">Avalanche</span>;
      case "snowball":
        return <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider">Snowball</span>;
      case "custom":
        return <span className="px-2.5 py-1 rounded bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 text-xs font-semibold uppercase tracking-wider">Custom</span>;
      default:
        return null;
    }
  };

  return (
    <div
      className={`relative min-w-[320px] max-w-[360px] flex-shrink-0 flex flex-col justify-between bg-surface-light dark:bg-surface-dark border rounded-2xl p-5 ${
        isActive
          ? "border-primary shadow-sm shadow-primary/20"
          : "border-border-light dark:border-border-dark"
      }`}
    >
      {/* Active Pill & Actions */}
      <div className="flex items-center justify-between mb-4">
        {isActive ? (
          <div className="flex items-center gap-1.5 text-sage font-medium text-sm">
            <CheckCircle2 size={16} />
            Active
          </div>
        ) : (
          <div className="invisible text-sm">Spacer</div> // keeps layout stable
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-1.5 text-text-muted-light hover:text-primary transition-colors rounded-lg hover:bg-border-light/30"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-text-muted-light hover:text-red-500 transition-colors rounded-lg hover:bg-border-light/30"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Title & Badge */}
      <div className="mb-6">
        {isEditingName ? (
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              autoFocus
              className="px-2 py-1 text-lg font-display text-text-main-light dark:text-text-main-dark bg-transparent border-b border-primary outline-none"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") {
                  setTempName(scenario.name);
                  setIsEditingName(false);
                }
              }}
              onBlur={handleSaveName}
            />
            <button onClick={handleSaveName} className="text-primary"><Check size={18} /></button>
          </div>
        ) : (
          <h3
            className="text-xl font-display font-medium text-text-main-light dark:text-text-main-dark mb-2 cursor-pointer hover:text-primary transition-colors flex items-center gap-2 group"
            onClick={() => setIsEditingName(true)}
          >
            {scenario.name}
            <Pencil size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </h3>
        )}

        {getStrategyBadge(scenario.strategy)}
      </div>

      {/* Metrics */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-muted-light dark:text-text-muted-dark text-sm">
            <Calendar size={16} /> Payoff Date
          </div>
          <div className="font-semibold text-text-main-light dark:text-text-main-dark">
            {formatDate(result.payoffDate)}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-muted-light dark:text-text-muted-dark text-sm">
            <Target size={16} /> Total Interest
          </div>
          <div className="font-semibold text-text-main-light dark:text-text-main-dark">
            {formatCurrency(result.totalInterestPaid, currency)}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-muted-light dark:text-text-muted-dark text-sm">
            <DollarSign size={16} /> Extra Monthly
          </div>
          <div className="font-semibold text-primary">
            {scenario.extraMonthlyPayment > 0 ? "+" + formatCurrency(scenario.extraMonthlyPayment, currency) : "—"}
          </div>
        </div>
      </div>

      {/* Card Footer (Make Active Action) */}
      {!isActive ? (
        <button
          onClick={onMakeActive}
          className="w-full py-2.5 rounded-xl font-medium border border-border-light dark:border-border-dark text-text-main-light dark:text-text-main-dark hover:border-primary hover:text-primary transition-colors"
        >
          Make Active
        </button>
      ) : (
        <div className="w-full py-2.5 rounded-xl font-medium bg-sage/10 text-sage text-center">
          Current Strategy
        </div>
      )}
    </div>
  );
}
