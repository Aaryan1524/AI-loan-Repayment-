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
  isActive?: boolean;
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
    sipAmount: (row.monthly_sip as number) || undefined, // Mapping monthly_sip -> sipAmount
    useToRepay: (row.use_for_repayment ?? false) as boolean, // Mapping use_for_repayment -> useToRepay
  };
}

function mapIncomeRow(row: Record<string, unknown>): IncomeSource {
  return {
    id: row.id as string,
    type: row.type as IncomeSource["type"],
    name: row.name as string,
    monthlyAmount: (row.monthly_amount ?? 0) as number,
    // Note: The schema provided did not have annual_amount, is_irregular, use_to_repay on the table
    // If they were removed from the schema, we must just handle what is available.
    annualAmount: (row.annual_amount as number) || undefined,
    frequency: (row.frequency as IncomeSource["frequency"]) || undefined,
    isIrregular: (row.is_irregular as boolean) || undefined,
    useToRepay: (row.use_to_repay ?? true) as boolean,
  };
}

function mapScenarioRow(row: Record<string, unknown>): Scenario {
  return {
    id: row.id as string,
    name: row.name as string,
    strategy: (row.strategy ?? "baseline") as Strategy,
    customOrder: (row.loan_order as string[]) || undefined, // Mapping loan_order -> customOrder
    lumpSums: (row.lump_sums as LumpSum[]) || [],
    extraMonthlyPayment: (row.extra_monthly ?? 0) as number, // Mapping extra_monthly -> extraMonthlyPayment
    isActive: (row.is_active ?? false) as boolean,
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
    // If already hydrated in this session, do not re-fetch on remounts
    if (get().isHydrated) return;

    set({ isLoading: true });
    const supabase = createClient();

    // Ensure we have a session before querying to satisfy RLS
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn("Hydration skipped: No authenticated user found.", authError);
      set({ isLoading: false, isHydrated: true });
      return;
    }

    const [loansRes, assetsRes, incomeRes, scenariosRes] = await Promise.all([
      supabase.from("loans").select("*"),
      supabase.from("assets").select("*"),
      supabase.from("income_sources").select("*"),
      supabase.from("scenarios").select("*"),
    ]);

    // Log any query errors for debugging
    if (loansRes.error) console.error("Error fetching loans:", loansRes.error);
    if (assetsRes.error) console.error("Error fetching assets:", assetsRes.error);
    if (incomeRes.error) console.error("Error fetching income:", incomeRes.error);
    if (scenariosRes.error) console.error("Error fetching scenarios:", scenariosRes.error);

    const loans = (loansRes.data || []).map(mapLoanRow);
    const assets = (assetsRes.data || []).map(mapAssetRow);
    const incomeSources = (incomeRes.data || []).map(mapIncomeRow);
    const scenarios = (scenariosRes.data || []).map(mapScenarioRow);

    // Default to a baseline scenario if none exist
    let activeScen = scenarios.find((s) => s.isActive)?.id || scenarios[0]?.id || "";
    
    if (scenarios.length === 0) {
       const defaultScenario: Scenario = {
         id: crypto.randomUUID(),
         name: "Default Plan",
         strategy: "avalanche",
         lumpSums: [],
         extraMonthlyPayment: 0,
         isActive: true,
       };
       scenarios.push(defaultScenario);
       activeScen = defaultScenario.id;
       // Background insert default scenario
       supabase.from("scenarios").insert({
         id: defaultScenario.id,
         user_id: user.id,
         name: defaultScenario.name,
         strategy: defaultScenario.strategy,
         lump_sums: [],
         extra_monthly: 0,
         is_active: true
       }).then();
    }

    set({
      loans,
      assets,
      incomeSources,
      scenarios,
      activeScenario: activeScen,
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
        console.warn("Supabase write skipped: User not authenticated.");
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
          prepayment_penalty: loan.prepaymentPenalty || 0,
          start_date: loan.startDate || null,
          notes: loan.notes || null,
        })
        .then(({ error }) => {
          if (error) {
            console.error("Supabase loan insert failed (Check if ID is UUID):", error);
          }
        });
    });
  },

  updateLoan: (loan) => {
    const prev = get().loans;
    set((s) => ({ loans: s.loans.map((l) => (l.id === loan.id ? loan : l)) }));

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
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
          prepayment_penalty: loan.prepaymentPenalty || 0,
          start_date: loan.startDate || null,
          notes: loan.notes || null,
        })
        .eq("id", loan.id)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Supabase loan update failed:", error);
            set({ loans: prev });
          }
        });
    });
  },

  removeLoan: (id) => {
    const prev = get().loans;
    set((s) => ({ loans: s.loans.filter((l) => l.id !== id) }));

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { set({ loans: prev }); return; }
      supabase
        .from("loans")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Supabase loan delete failed:", error);
            set({ loans: prev });
          }
        });
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
          monthly_sip: asset.sipAmount || null,
          use_for_repayment: asset.useToRepay,
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("assets")
        .update({
          type: asset.type,
          name: asset.name,
          value: asset.value,
          return_rate: asset.returnRate,
          maturity_date: asset.maturityDate || null,
          monthly_sip: asset.sipAmount || null,
          use_for_repayment: asset.useToRepay,
        })
        .eq("id", asset.id)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Supabase asset update failed:", error);
            set({ assets: prev });
          }
        });
    });
  },

  removeAsset: (id) => {
    const prev = get().assets;
    set((s) => ({ assets: s.assets.filter((a) => a.id !== id) }));

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { set({ assets: prev }); return; }
      supabase
        .from("assets")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Supabase asset delete failed:", error);
            set({ assets: prev });
          }
        });
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
          frequency: source.frequency || 'monthly',
          is_irregular: source.isIrregular || false,
          use_to_repay: source.useToRepay ?? true,
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("income_sources")
        .update({
          type: source.type,
          name: source.name,
          monthly_amount: source.monthlyAmount,
          annual_amount: source.annualAmount || null,
          frequency: source.frequency || 'monthly',
          is_irregular: source.isIrregular || false,
          use_to_repay: source.useToRepay ?? true,
        })
        .eq("id", source.id)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Supabase income update failed:", error);
            set({ incomeSources: prev });
          }
        });
    });
  },

  removeIncomeSource: (id) => {
    const prev = get().incomeSources;
    set((s) => ({ incomeSources: s.incomeSources.filter((i) => i.id !== id) }));

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { set({ incomeSources: prev }); return; }
      supabase
        .from("income_sources")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Supabase income delete failed:", error);
            set({ incomeSources: prev });
          }
        });
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
          loan_order: scenario.customOrder || null,
          lump_sums: scenario.lumpSums,
          extra_monthly: scenario.extraMonthlyPayment,
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("scenarios")
        .update({
          name: scenario.name,
          strategy: scenario.strategy,
          loan_order: scenario.customOrder || null,
          lump_sums: scenario.lumpSums,
          extra_monthly: scenario.extraMonthlyPayment,
        })
        .eq("id", scenario.id)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Supabase scenario update failed:", error);
            set({ scenarios: prev });
          }
        });
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { set({ scenarios: prev }); return; }
      supabase
        .from("scenarios")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Supabase scenario delete failed:", error);
            set({ scenarios: prev });
          }
        });
    });
  },

  setActiveScenario: (id) => {
    set({ activeScenario: id });
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      // Optimistically update active flag in DB
      supabase.from("scenarios").update({ is_active: false }).eq("user_id", user.id).then(() => {
        supabase.from("scenarios").update({ is_active: true }).eq("id", id).eq("user_id", user.id).then();
      });
    });
  },

  setCurrency: (currency) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    }
    set({ currency });
  },
}));
