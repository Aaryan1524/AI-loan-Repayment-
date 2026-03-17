"use client";

import { useState, useMemo } from "react";
import AppNavigation from "../../components/layout/AppNavigation";
import { Plus } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Scenario } from "@/lib/store";
import { calculateRepayment } from "@/lib/calculator";
import { useFinancialData } from "@/hooks/useFinancialData";
import { ScenarioCard } from "@/components/scenarios/ScenarioCard";
import { ScenarioDrawer } from "@/components/scenarios/ScenarioDrawer";
import { ComparisonTable } from "@/components/scenarios/ComparisonTable";



export default function ScenariosPage() {
  const { loans, assets, incomeSources, scenarios, activeScenario, isLoading } = useFinancialData();
  const { setActiveScenario, addScenario, updateScenario, removeScenario } = useAppStore();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);

  // Compute results for all scenarios
  const results = useMemo(() => {
    const res: Record<string, ReturnType<typeof calculateRepayment>> = {};
    for (const sc of scenarios) {
      res[sc.id] = calculateRepayment(
        loans,
        assets,
        incomeSources,
        sc.lumpSums,
        sc.strategy,
        sc.customOrder,
        sc.extraMonthlyPayment
      );
    }
    return res;
  }, [loans, assets, incomeSources, scenarios]);

  const handleSaveScenario = (scenario: Scenario) => {
    if (editingScenario) {
      updateScenario(scenario);
    } else {
      addScenario(scenario);
    }
  };

  const handleRename = (id: string, newName: string) => {
    const sc = scenarios.find((s) => s.id === id);
    if (sc) updateScenario({ ...sc, name: newName });
  };

  // Find the baseline scenario to use for comparison
  const baselineId = scenarios.find((s) => s.strategy === "baseline")?.id || scenarios[0]?.id;

  if (isLoading) {
    return (
      <div className="bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted-light">Loading scenarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-main-light dark:text-text-main-dark min-h-screen flex">
      {/* ─── Sidebar ─── */}
      <AppNavigation />

      {/* ─── Main Content ─── */}
      <main className="flex-1 p-10 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-semibold mb-2 text-text-main-light dark:text-text-main-dark">
              My Scenarios
            </h1>
            <p className="text-text-muted-light dark:text-text-muted-dark">
              Build custom repayment strategies and compare their impact on your timeline.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingScenario(null);
              setDrawerOpen(true);
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
          >
            <Plus size={18} />
            New Scenario
          </button>
        </div>

        {/* Cards Row */}
        <div className="flex gap-6 overflow-x-auto pb-6 snap-x">
          {scenarios.map((sc) => (
            <div key={sc.id} className="snap-start">
              <ScenarioCard
                scenario={sc}
                isActive={activeScenario === sc.id}
                result={results[sc.id]}
                onMakeActive={() => setActiveScenario(sc.id)}
                onEdit={() => {
                  setEditingScenario(sc);
                  setDrawerOpen(true);
                }}
                onDelete={() => removeScenario(sc.id)}
                onRename={(newName) => handleRename(sc.id, newName)}
              />
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="mt-4">
          <h2 className="text-xl font-display font-medium text-text-main-light dark:text-text-main-dark mb-4">
            Strategy Comparison
          </h2>
          <ComparisonTable scenarios={scenarios} results={results} baselineId={baselineId} />
        </div>
      </main>

      <ScenarioDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        scenario={editingScenario}
        onSave={handleSaveScenario}
      />
    </div>
  );
}
