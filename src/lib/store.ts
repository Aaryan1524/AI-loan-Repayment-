import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { CurrencyCode } from "@/lib/formatCurrency";
import { CURRENCY_STORAGE_KEY } from "@/lib/formatCurrency";

/* ─── Types ─── */
export interface Loan {
  id: string;
  type: "mortgage" | "student" | "auto" | "credit_card" | "personal" | "other";
  name: string;
  principal: number;
  rate: number; // annual %
  termMonths: number; // 0 = revolving / no fixed term
  balance: number;
  // Advanced fields
  emiOverride?: number;
  prepaymentPenalty?: number;
  startDate?: string;
  notes?: string;
}

export interface Asset {
  id: string;
  type: "stocks" | "mutual_fund" | "fd" | "savings";
  name: string;
  value: number; // current value or principal for FD
  returnRate: number; // annual %
  maturityDate: string | null; // ISO date or null
  sipAmount?: number; // SIP monthly amount (mutual funds only)
  useToRepay: boolean; // whether to factor into repayment calc
}

export interface IncomeSource {
  id: string;
  type: "salary" | "rental" | "dividend" | "freelance";
  name: string;
  monthlyAmount: number; // monthly amount (derived for dividends)
  annualAmount?: number; // for dividends: estimated annual
  frequency?: "monthly" | "quarterly" | "annual"; // dividend payout frequency
  isIrregular?: boolean; // freelance flag
  useToRepay?: boolean; // whether to use for loan repayment
}

export interface LumpSum {
  id: string;
  date: string;
  amount: number;
  label: string;
}

export type Strategy = "baseline" | "avalanche" | "snowball" | "custom";

export interface Scenario {
  id: string;
  name: string;
  strategy: Strategy;
  customOrder?: string[]; // Array of loan IDs for custom ranking
  lumpSums: LumpSum[];
  extraMonthlyPayment: number;
}

export interface AppState {
  /* ─── Data ─── */
  loans: Loan[];
  assets: Asset[];
  incomeSources: IncomeSource[];
  lumpSums: LumpSum[];
  scenarios: Scenario[];
  activeScenario: string;
  currency: CurrencyCode;

  /* ─── Auth / Loading ─── */
  isLoading: boolean;
  isHydrated: boolean;

  /* ─── Hydrate from Supabase ─── */
  hydrateFromSupabase: () => Promise<void>;

  /* ─── Loan actions ─── */
  addLoan: (loan: Loan) => void;
  updateLoan: (loan: Loan) => void;
  removeLoan: (id: string) => void;

  /* ─── Asset actions ─── */
  addAsset: (asset: Asset) => void;
  updateAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;

  /* ─── Income actions ─── */
  addIncomeSource: (source: IncomeSource) => void;
  updateIncomeSource: (source: IncomeSource) => void;
  removeIncomeSource: (id: string) => void;

  /* ─── Scenario actions ─── */
  addScenario: (scenario: Scenario) => void;
  updateScenario: (scenario: Scenario) => void;
  removeScenario: (id: string) => void;

  setActiveScenario: (id: string) => void;
  setCurrency: (currency: CurrencyCode) => void;
}

/* ─── Helper: map Supabase rows to app types ─── */
function mapLoanRow(row: Record<string, unknown>): Loan {
  return {
    id: row.id as string,
    type: row.type as Loan["type"],
    name: row.name as string,
    principal: row.principal as number,
    rate: row.rate as number,
    termMonths: (row.term_months ?? 0) as number,
    balance: row.balance as number,
    emiOverride: (row.emi_override as number) || undefined,
    prepaymentPenalty: (row.prepayment_penalty as number) || undefined,
    startDate: (row.start_date as string) || undefined,
    notes: (row.notes as string) || undefined,
  };
}

function mapAssetRow(row: Record<string, unknown>): Asset {
  return {
    id: row.id as string,
    type: row.type as Asset["type"],
    name: row.name as string,
    value: row.value as number,
    returnRate: (row.return_rate ?? 0) as number,
    maturityDate: (row.maturity_date as string) || null,
    sipAmount: (row.sip_amount as number) || undefined,
    useToRepay: (row.use_to_repay ?? false) as boolean,
  };
}

function mapIncomeRow(row: Record<string, unknown>): IncomeSource {
  return {
    id: row.id as string,
    type: row.type as IncomeSource["type"],
    name: row.name as string,
    monthlyAmount: (row.monthly_amount ?? 0) as number,
    annualAmount: (row.annual_amount as number) || undefined,
    frequency: (row.frequency as IncomeSource["frequency"]) || undefined,
    isIrregular: (row.is_irregular as boolean) || undefined,
    useToRepay: (row.use_to_repay ?? false) as boolean,
  };
}

function mapScenarioRow(row: Record<string, unknown>): Scenario {
  return {
    id: row.id as string,
    name: row.name as string,
    strategy: (row.strategy ?? "baseline") as Strategy,
    customOrder: (row.custom_order as string[]) || undefined,
    lumpSums: (row.lump_sums as LumpSum[]) || [],
    extraMonthlyPayment: (row.extra_monthly_payment ?? 0) as number,
  };
}

/* ─── Store ─── */
export const useAppStore = create<AppState>()((set, get) => ({
  loans: [],
  assets: [],
  incomeSources: [],
  lumpSums: [],
  scenarios: [],
  activeScenario: "",
  currency: (typeof window !== "undefined"
    ? (localStorage.getItem(CURRENCY_STORAGE_KEY) as CurrencyCode | null) ?? "USD"
    : "USD") as CurrencyCode,
  isLoading: true,
  isHydrated: false,

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  Hydrate from Supabase                                             */
  /* ═══════════════════════════════════════════════════════════════════ */
  hydrateFromSupabase: async () => {
    set({ isLoading: true });
    const supabase = createClient();

    const [loansRes, assetsRes, incomeRes, scenariosRes] = await Promise.all([
      supabase.from("loans").select("*"),
      supabase.from("assets").select("*"),
      supabase.from("income_sources").select("*"),
      supabase.from("scenarios").select("*"),
    ]);

    const loans = (loansRes.data || []).map(mapLoanRow);
    const assets = (assetsRes.data || []).map(mapAssetRow);
    const incomeSources = (incomeRes.data || []).map(mapIncomeRow);
    const scenarios = (scenariosRes.data || []).map(mapScenarioRow);

    set({
      loans,
      assets,
      incomeSources,
      scenarios,
      activeScenario: scenarios[0]?.id || "",
      isLoading: false,
      isHydrated: true,
    });
  },

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  Loan CRUD — optimistic + background Supabase write                */
  /* ═══════════════════════════════════════════════════════════════════ */
  addLoan: (loan) => {
    // Optimistic update — always keep in local state
    set((s) => ({ loans: [...s.loans, loan] }));

    // Background write — only attempt if authenticated
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        // Not logged in — loan stays in local state for this session
        return;
      }
      supabase
        .from("loans")
        .insert({
          id: loan.id,
          user_id: user.id,
          type: loan.type,
          name: loan.name,
          principal: loan.principal,
          rate: loan.rate,
          term_months: loan.termMonths,
          balance: loan.balance,
          emi_override: loan.emiOverride || null,
          prepayment_penalty: loan.prepaymentPenalty || null,
          start_date: loan.startDate || null,
          notes: loan.notes || null,
        })
        .then(({ error }) => {
          if (error) {
            console.error("Supabase loan insert failed:", error);
            // Don't rollback — loan stays visible; user can retry or refresh
          }
        });
    });
  },

  updateLoan: (loan) => {
    const prev = get().loans;
    set((s) => ({ loans: s.loans.map((l) => (l.id === loan.id ? loan : l)) }));

    const supabase = createClient();
    supabase
      .from("loans")
      .update({
        type: loan.type,
        name: loan.name,
        principal: loan.principal,
        rate: loan.rate,
        term_months: loan.termMonths,
        balance: loan.balance,
        emi_override: loan.emiOverride || null,
        prepayment_penalty: loan.prepaymentPenalty || null,
        start_date: loan.startDate || null,
        notes: loan.notes || null,
      })
      .eq("id", loan.id)
      .then(({ error }) => {
        if (error) {
          console.error("Supabase loan update failed:", error);
          set({ loans: prev });
        }
      });
  },

  removeLoan: (id) => {
    const prev = get().loans;
    set((s) => ({ loans: s.loans.filter((l) => l.id !== id) }));

    const supabase = createClient();
    supabase
      .from("loans")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("Supabase loan delete failed:", error);
          set({ loans: prev });
        }
      });
  },

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  Asset CRUD                                                        */
  /* ═══════════════════════════════════════════════════════════════════ */
  addAsset: (asset) => {
    set((s) => ({ assets: [...s.assets, asset] }));

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("assets")
        .insert({
          id: asset.id,
          user_id: user.id,
          type: asset.type,
          name: asset.name,
          value: asset.value,
          return_rate: asset.returnRate,
          maturity_date: asset.maturityDate || null,
          sip_amount: asset.sipAmount || null,
          use_to_repay: asset.useToRepay,
        })
        .then(({ error }) => {
          if (error) {
            console.error("Supabase asset insert failed:", error);
          }
        });
    });
  },

  updateAsset: (asset) => {
    const prev = get().assets;
    set((s) => ({ assets: s.assets.map((a) => (a.id === asset.id ? asset : a)) }));

    const supabase = createClient();
    supabase
      .from("assets")
      .update({
        type: asset.type,
        name: asset.name,
        value: asset.value,
        return_rate: asset.returnRate,
        maturity_date: asset.maturityDate || null,
        sip_amount: asset.sipAmount || null,
        use_to_repay: asset.useToRepay,
      })
      .eq("id", asset.id)
      .then(({ error }) => {
        if (error) {
          console.error("Supabase asset update failed:", error);
          set({ assets: prev });
        }
      });
  },

  removeAsset: (id) => {
    const prev = get().assets;
    set((s) => ({ assets: s.assets.filter((a) => a.id !== id) }));

    const supabase = createClient();
    supabase
      .from("assets")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("Supabase asset delete failed:", error);
          set({ assets: prev });
        }
      });
  },

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  Income CRUD                                                       */
  /* ═══════════════════════════════════════════════════════════════════ */
  addIncomeSource: (source) => {
    set((s) => ({ incomeSources: [...s.incomeSources, source] }));

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("income_sources")
        .insert({
          id: source.id,
          user_id: user.id,
          type: source.type,
          name: source.name,
          monthly_amount: source.monthlyAmount,
          annual_amount: source.annualAmount || null,
          frequency: source.frequency || null,
          is_irregular: source.isIrregular || null,
        })
        .then(({ error }) => {
          if (error) {
            console.error("Supabase income insert failed:", error);
          }
        });
    });
  },

  updateIncomeSource: (source) => {
    const prev = get().incomeSources;
    set((s) => ({
      incomeSources: s.incomeSources.map((i) => (i.id === source.id ? source : i)),
    }));

    const supabase = createClient();
    supabase
      .from("income_sources")
      .update({
        type: source.type,
        name: source.name,
        monthly_amount: source.monthlyAmount,
        annual_amount: source.annualAmount || null,
        frequency: source.frequency || null,
        is_irregular: source.isIrregular || null,
      })
      .eq("id", source.id)
      .then(({ error }) => {
        if (error) {
          console.error("Supabase income update failed:", error);
          set({ incomeSources: prev });
        }
      });
  },

  removeIncomeSource: (id) => {
    const prev = get().incomeSources;
    set((s) => ({ incomeSources: s.incomeSources.filter((i) => i.id !== id) }));

    const supabase = createClient();
    supabase
      .from("income_sources")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("Supabase income delete failed:", error);
          set({ incomeSources: prev });
        }
      });
  },

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  Scenario CRUD                                                     */
  /* ═══════════════════════════════════════════════════════════════════ */
  addScenario: (scenario) => {
    set((s) => ({ scenarios: [...s.scenarios, scenario] }));

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("scenarios")
        .insert({
          id: scenario.id,
          user_id: user.id,
          name: scenario.name,
          strategy: scenario.strategy,
          custom_order: scenario.customOrder || null,
          lump_sums: scenario.lumpSums,
          extra_monthly_payment: scenario.extraMonthlyPayment,
        })
        .then(({ error }) => {
          if (error) {
            console.error("Supabase scenario insert failed:", error);
          }
        });
    });
  },

  updateScenario: (scenario) => {
    const prev = get().scenarios;
    set((s) => ({
      scenarios: s.scenarios.map((sc) => (sc.id === scenario.id ? scenario : sc)),
    }));

    const supabase = createClient();
    supabase
      .from("scenarios")
      .update({
        name: scenario.name,
        strategy: scenario.strategy,
        custom_order: scenario.customOrder || null,
        lump_sums: scenario.lumpSums,
        extra_monthly_payment: scenario.extraMonthlyPayment,
      })
      .eq("id", scenario.id)
      .then(({ error }) => {
        if (error) {
          console.error("Supabase scenario update failed:", error);
          set({ scenarios: prev });
        }
      });
  },

  removeScenario: (id) => {
    const prev = get().scenarios;
    set((s) => ({
      scenarios: s.scenarios.filter((sc) => sc.id !== id),
      activeScenario:
        s.activeScenario === id
          ? s.scenarios.find((sc) => sc.id !== id)?.id || ""
          : s.activeScenario,
    }));

    const supabase = createClient();
    supabase
      .from("scenarios")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("Supabase scenario delete failed:", error);
          set({ scenarios: prev });
        }
      });
  },

  setActiveScenario: (id) => set({ activeScenario: id }),

  setCurrency: (currency) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    }
    set({ currency });
  },
}));
