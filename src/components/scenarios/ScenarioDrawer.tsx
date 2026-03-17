"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Scenario, Strategy, LumpSum } from "@/lib/store";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scenario?: Scenario | null;
  onSave: (scenario: Scenario) => void;
}

export function ScenarioDrawer({ isOpen, onClose, scenario, onSave }: Props) {
  const loans = useAppStore((s) => s.loans);
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [extraPayment, setExtraPayment] = useState<number>(0);
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [lumpSums, setLumpSums] = useState<LumpSum[]>([]);

  // Initialize form when drawer opens
  useEffect(() => {
    if (isOpen) {
      if (scenario) {
        setName(scenario.name);
        setStrategy(scenario.strategy);
        setExtraPayment(scenario.extraMonthlyPayment);
        setCustomOrder(scenario.customOrder || loans.map((l) => l.id));
        setLumpSums(scenario.lumpSums || []);
      } else {
        setName("New Scenario");
        setStrategy("avalanche");
        setExtraPayment(0);
        setCustomOrder(loans.map((l) => l.id));
        setLumpSums([]);
      }
    }
  }, [isOpen, scenario, loans]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: scenario ? scenario.id : crypto.randomUUID(),
      name: name.trim(),
      strategy,
      extraMonthlyPayment: extraPayment,
      customOrder: strategy === "custom" ? customOrder : undefined,
      lumpSums,
    });
    onClose();
  };

  const moveLoan = (index: number, direction: "up" | "down") => {
    const newOrder = [...customOrder];
    if (direction === "up" && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    } else if (direction === "down" && index < newOrder.length - 1) {
      [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
    }
    setCustomOrder(newOrder);
  };

  const addLumpSum = () => {
    setLumpSums([
      ...lumpSums,
      {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split("T")[0],
        amount: 1000,
        label: "New Payment",
      },
    ]);
  };

  const updateLumpSum = (id: string, field: keyof LumpSum, value: string | number) => {
    setLumpSums(lumpSums.map((ls) => (ls.id === id ? { ...ls, [field]: value } : ls)));
  };

  const removeLumpSum = (id: string) => {
    setLumpSums(lumpSums.filter((ls) => ls.id !== id));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-surface-light dark:bg-surface-dark shadow-2xl z-50 flex flex-col border-l border-border-light dark:border-border-dark animate-slide-in-right transform transition-transform duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-display font-medium text-text-main-light dark:text-text-main-dark">
            {scenario ? "Edit Scenario" : "New Scenario"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-border-light/30 rounded-full text-text-muted-light">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-main-light dark:text-text-main-dark">
              Scenario Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-border-light dark:border-border-dark rounded-xl bg-transparent focus:outline-none focus:border-primary transition-colors text-text-main-light dark:text-text-main-dark"
              placeholder="e.g. Aggressive Payoff"
            />
          </div>

          {/* Strategy Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-text-main-light dark:text-text-main-dark">
              Repayment Strategy
            </label>
            <div className="space-y-2">
              {(["baseline", "avalanche", "snowball", "custom"] as Strategy[]).map((strat) => {
                const descriptions: Record<Strategy, { title: string; desc: string }> = {
                  baseline: {
                    title: "Baseline (No Strategy)",
                    desc: "Pay only minimum payments. See the default timeline.",
                  },
                  avalanche: {
                    title: "Avalanche (Highest Interest First)",
                    desc: "Pay highest-rate loans first. Saves the most interest mathematically.",
                  },
                  snowball: {
                    title: "Snowball (Smallest Balance First)",
                    desc: "Pay smallest loans first. Quick wins for motivation.",
                  },
                  custom: {
                    title: "Custom (Manual Order)",
                    desc: "You decide which loans to pay first. Drag to reorder.",
                  },
                };
                const info = descriptions[strat];
                return (
                  <button
                    key={strat}
                    onClick={() => setStrategy(strat)}
                    className={`w-full text-left p-3 border rounded-xl transition-all ${
                      strategy === strat
                        ? "border-primary bg-primary/10 dark:bg-primary/20"
                        : "border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:border-primary/50"
                    }`}
                  >
                    <div className="font-medium text-text-main-light dark:text-text-main-dark">
                      {info.title}
                    </div>
                    <div className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">
                      {info.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Ranking */}
          {loans.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-text-main-light dark:text-text-main-dark">
                  Loan Priority Order
                </label>
                {strategy !== "custom" && (
                  <span className="text-xs text-text-muted-light dark:text-text-muted-dark bg-border-light/30 dark:bg-border-dark/30 px-2 py-1 rounded">
                    {strategy === "avalanche" ? "Auto-sorted by interest rate" : strategy === "snowball" ? "Auto-sorted by balance" : "Minimums only"}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {customOrder.map((loanId, idx) => {
                  const loan = loans.find((l) => l.id === loanId);
                  if (!loan) return null;
                  return (
                    <div
                      key={loanId}
                      className={`flex items-center justify-between p-3 border rounded-xl ${
                        strategy === "custom"
                          ? "border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark"
                          : "border-border-light/50 dark:border-border-dark/50 bg-background-light dark:bg-background-dark opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          strategy === "custom"
                            ? "bg-border-light text-text-muted-light"
                            : "bg-border-light/30 text-text-muted-light/60"
                        }`}>
                          {idx + 1}
                        </div>
                        <span className={`text-sm font-medium ${
                          strategy === "custom"
                            ? "text-text-main-light dark:text-text-main-dark"
                            : "text-text-muted-light dark:text-text-muted-dark"
                        }`}>
                          {loan.name}
                        </span>
                      </div>
                      {strategy === "custom" && (
                        <div className="flex flex-col gap-1">
                          <button
                            disabled={idx === 0}
                            onClick={() => moveLoan(idx, "up")}
                            className="hover:text-primary disabled:opacity-30 disabled:hover:text-inherit"
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            disabled={idx === customOrder.length - 1}
                            onClick={() => moveLoan(idx, "down")}
                            className="hover:text-primary disabled:opacity-30 disabled:hover:text-inherit"
                          >
                            <ArrowDown size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Extra Monthly Payment */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-main-light dark:text-text-main-dark">
              Extra Monthly Payment
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-text-muted-light">
                $
              </span>
              <input
                type="number"
                value={extraPayment || ""}
                onChange={(e) => setExtraPayment(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-2 border border-border-light dark:border-border-dark rounded-xl bg-transparent focus:outline-none focus:border-primary transition-colors text-text-main-light dark:text-text-main-dark"
                placeholder="0"
                min="0"
              />
            </div>
            <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
              Additional principal applied every month on top of minimums & surplus.
            </p>
          </div>

          {/* Lump Sums */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-main-light dark:text-text-main-dark">
                One-off Injections
              </label>
              <button
                onClick={addLumpSum}
                className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-md"
              >
                <Plus size={14} /> Add Payment
              </button>
            </div>
            
            {lumpSums.length === 0 ? (
              <div className="p-4 border border-dashed border-border-light dark:border-border-dark rounded-xl text-center text-sm text-text-muted-light">
                No one-off payments added.
              </div>
            ) : (
              <div className="space-y-3">
                {lumpSums.map((ls) => (
                  <div key={ls.id} className="p-3 border border-border-light dark:border-border-dark rounded-xl bg-background-light dark:bg-background-dark space-y-3 relative">
                    <button
                      onClick={() => removeLumpSum(ls.id)}
                      className="absolute top-3 right-3 text-text-muted-light hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                    
                    <div>
                      <input
                        type="text"
                        value={ls.label}
                        onChange={(e) => updateLumpSum(ls.id, "label", e.target.value)}
                        placeholder="e.g. Tax Refund"
                        className="w-[85%] text-sm font-medium bg-transparent border-b border-transparent hover:border-border-light focus:border-primary outline-none text-text-main-light dark:text-text-main-dark pb-1"
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-text-muted-light block mb-1">Amount</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted-light text-xs">$</span>
                          <input
                            type="number"
                            value={ls.amount || ""}
                            onChange={(e) => updateLumpSum(ls.id, "amount", Number(e.target.value))}
                            className="w-full pl-6 pr-2 py-1.5 text-sm border border-border-light dark:border-border-dark rounded-md bg-transparent focus:outline-none focus:border-primary text-text-main-light dark:text-text-main-dark"
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-text-muted-light block mb-1">Date</label>
                        <input
                          type="date"
                          value={ls.date}
                          onChange={(e) => updateLumpSum(ls.id, "date", e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-border-light dark:border-border-dark rounded-md bg-transparent focus:outline-none focus:border-primary text-text-main-light dark:text-text-main-dark"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border-light dark:border-border-dark">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            Save Scenario
          </button>
        </div>
      </div>
    </>
  );
}
