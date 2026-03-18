"use client";

import { useState, useMemo, useEffect } from "react";
import AppNavigation from "../../components/layout/AppNavigation";
import { useAppStore, type Asset, type IncomeSource } from "@/lib/store";
import { useFinancialData } from "@/hooks/useFinancialData";
import { formatCurrency, CURRENCY_SYMBOLS, type CurrencyCode } from "@/lib/formatCurrency";
import {
  TrendingUp,
  Landmark,
  PiggyBank,
  Briefcase,
  Home,
  Plus,
  Pencil,
  Trash2,
  BarChart3,
  DollarSign,
  CalendarDays,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";


/* ─── Asset type config ─── */
const assetTypeConfig: Record<
  Asset["type"],
  { label: string; icon: React.ReactNode; bg: string; fg: string }
> = {
  stocks: {
    label: "Stocks / ETFs",
    icon: <TrendingUp size={20} />,
    bg: "bg-[#E8F0EA]",
    fg: "text-[#5A7C60]",
  },
  mutual_fund: {
    label: "Mutual Fund",
    icon: <BarChart3 size={20} />,
    bg: "bg-[#EAEAF4]",
    fg: "text-[#6B6B99]",
  },
  fd: {
    label: "Fixed Deposit",
    icon: <Landmark size={20} />,
    bg: "bg-[#F5E8E5]",
    fg: "text-[#A65B50]",
  },
  savings: {
    label: "Cash / Savings",
    icon: <PiggyBank size={20} />,
    bg: "bg-[#F4EED1]",
    fg: "text-[#8C8040]",
  },
};

/* ─── Income type config ─── */
const incomeTypeConfig: Record<
  IncomeSource["type"],
  { label: string; icon: React.ReactNode; bg: string; fg: string }
> = {
  salary: {
    label: "Salary",
    icon: <Briefcase size={20} />,
    bg: "bg-[#E8F0EA]",
    fg: "text-[#5A7C60]",
  },
  rental: {
    label: "Rental Income",
    icon: <Home size={20} />,
    bg: "bg-[#EAEAF4]",
    fg: "text-[#6B6B99]",
  },
  dividend: {
    label: "Dividends",
    icon: <DollarSign size={20} />,
    bg: "bg-[#F5E8E5]",
    fg: "text-[#A65B50]",
  },
  freelance: {
    label: "Freelance / Side",
    icon: <CalendarDays size={20} />,
    bg: "bg-[#F4EED1]",
    fg: "text-[#8C8040]",
  },
};

/* ─── Helpers ─── */
function generateId() {
  return crypto.randomUUID();
}



/* ═══════════════════════════════════════════════════════════════════ */
/*  Asset Form Drawer                                                 */
/* ═══════════════════════════════════════════════════════════════════ */
function AssetFormDrawer({
  isOpen,
  onClose,
  onSubmit,
  editing,
  currencySymbol,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (a: Asset) => void;
  editing: Asset | null;
  currency: CurrencyCode;
  currencySymbol: string;
}) {
  const [type, setType] = useState<Asset["type"]>(editing?.type ?? "stocks");
  const [name, setName] = useState(editing?.name ?? "");
  const [value, setValue] = useState(editing?.value?.toString() ?? "");
  const [returnRate, setReturnRate] = useState(editing?.returnRate?.toString() ?? "");
  const [maturityDate, setMaturityDate] = useState(editing?.maturityDate ?? "");
  const [sipAmount, setSipAmount] = useState(editing?.sipAmount?.toString() ?? "");
  const [useToRepay, setUseToRepay] = useState(editing?.useToRepay ?? false);

  // Reset when editing changes
  const resetForm = () => {
    setType(editing?.type ?? "stocks");
    setName(editing?.name ?? "");
    setValue(editing?.value?.toString() ?? "");
    setReturnRate(editing?.returnRate?.toString() ?? "");
    setMaturityDate(editing?.maturityDate ?? "");
    setSipAmount(editing?.sipAmount?.toString() ?? "");
    setUseToRepay(editing?.useToRepay ?? false);
  };

  // Auto-suggest name on type change
  const handleTypeChange = (t: Asset["type"]) => {
    setType(t);
    if (!name || Object.values(assetTypeConfig).some((c) => c.label === name)) {
      setName(assetTypeConfig[t].label);
    }
  };

  const handleSubmit = () => {
    const asset: Asset = {
      id: editing?.id ?? generateId(),
      type,
      name: name || assetTypeConfig[type].label,
      value: parseFloat(value) || 0,
      returnRate: parseFloat(returnRate) || 0,
      maturityDate: maturityDate || null,
      sipAmount: type === "mutual_fund" ? parseFloat(sipAmount) || undefined : undefined,
      useToRepay,
    };
    onSubmit(asset);
    onClose();
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 h-[90vh] md:right-0 md:top-0 md:h-full md:w-[480px] bg-surface-light border-l border-border-light shadow-2xl z-50 flex flex-col animate-slide-in rounded-t-2xl md:rounded-none">
        {/* Mobile drag handle */}
        <div className="md:hidden w-8 h-1 bg-[#E4D9C8] rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 md:p-6 py-4 border-b border-border-light">
          <h2 className="text-xl md:text-2xl font-bold">{editing ? "Edit asset" : "Add new asset"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-background-light rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 md:p-6 py-4 space-y-6 pb-24 md:pb-6">
          {/* Type selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-2 block">
              Asset type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(assetTypeConfig) as Asset["type"][]).map((t) => {
                const cfg = assetTypeConfig[t];
                const selected = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => handleTypeChange(t)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors text-sm font-medium ${
                      selected
                        ? `${cfg.bg} border-current ${cfg.fg}`
                        : "border-border-light text-text-muted-light hover:bg-background-light"
                    }`}
                  >
                    {cfg.icon}
                    <span className="text-[11px] text-center leading-tight">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-2 block">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vanguard S&P 500"
              className="w-full px-4 h-12 md:h-11 rounded-xl border border-border-light bg-background-light text-text-main-light outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Value */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-2 block">
              {type === "fd" ? "Principal amount" : "Current value"}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted-light font-medium">{currencySymbol}</span>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="10,000"
                className="w-full pl-8 pr-4 h-12 md:h-11 rounded-xl border border-border-light bg-background-light text-text-main-light outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Return rate — shown for stocks, mutual_fund, fd */}
          {type !== "savings" && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-2 block">
                {type === "fd" ? "Interest rate" : "Estimated annual return"}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={returnRate}
                  onChange={(e) => setReturnRate(e.target.value)}
                  placeholder="8.5"
                  className="w-full px-4 h-12 md:h-11 pr-10 rounded-xl border border-border-light bg-background-light text-text-main-light outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted-light font-medium">%</span>
              </div>
            </div>
          )}

          {/* Maturity date — FD */}
          {type === "fd" && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-2 block">
                Maturity date
              </label>
              <input
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
                className="w-full px-4 h-12 md:h-11 rounded-xl border border-border-light bg-background-light text-text-main-light outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {/* SIP amount — mutual funds */}
          {type === "mutual_fund" && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-2 block">
                SIP monthly amount <span className="font-normal text-text-muted-light">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted-light font-medium">{currencySymbol}</span>
                <input
                  type="number"
                  value={sipAmount}
                  onChange={(e) => setSipAmount(e.target.value)}
                  placeholder="500"
                  className="w-full pl-8 pr-4 h-12 md:h-11 rounded-xl border border-border-light bg-background-light text-text-main-light outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}

          {/* Use to repay toggle */}
          <div className="flex items-center justify-between p-4 bg-background-light rounded-xl border border-border-light">
            <div>
              <div className="font-medium text-sm">Use to repay loan</div>
              <div className="text-xs text-text-muted-light mt-0.5">
                {type === "fd"
                  ? "Inject value at maturity as a lump sum"
                  : type === "savings"
                  ? "Use current amount as immediate lump sum"
                  : "Use current value as lump sum injection"}
              </div>
            </div>
            <button
              onClick={() => setUseToRepay(!useToRepay)}
              className={`transition-colors ${useToRepay ? "text-sage" : "text-text-muted-light"}`}
            >
              {useToRepay ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 md:p-6 py-4 border-t border-border-light flex gap-3 pb-safe">
          <button
            onClick={() => { onClose(); resetForm(); }}
            className="flex-1 h-12 md:h-11 rounded-xl border border-border-light text-text-main-light font-medium hover:bg-background-light transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 h-12 md:h-11 rounded-xl bg-primary text-white font-medium hover:bg-opacity-90 transition-opacity"
          >
            {editing ? "Save changes" : "Add asset"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Income Source Form Drawer                                         */
/* ═══════════════════════════════════════════════════════════════════ */
function IncomeFormDrawer({
  isOpen,
  onClose,
  onSubmit,
  editing,
  currency,
  currencySymbol,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (s: IncomeSource) => void;
  editing: IncomeSource | null;
  currency: CurrencyCode;
  currencySymbol: string;
}) {
  const [type, setType] = useState<IncomeSource["type"]>(editing?.type ?? "salary");
  const [name, setName] = useState(editing?.name ?? "");
  const [monthlyAmount, setMonthlyAmount] = useState(editing?.monthlyAmount?.toString() ?? "");
  const [annualAmount, setAnnualAmount] = useState(editing?.annualAmount?.toString() ?? "");
  const [frequency, setFrequency] = useState<"monthly" | "quarterly" | "annual">(
    editing?.frequency ?? "quarterly"
  );
  const [isIrregular, setIsIrregular] = useState(editing?.isIrregular ?? false);
  const [useToRepay, setUseToRepay] = useState(editing?.useToRepay ?? true);

  const resetForm = () => {
    setType(editing?.type ?? "salary");
    setName(editing?.name ?? "");
    setMonthlyAmount(editing?.monthlyAmount?.toString() ?? "");
    setAnnualAmount(editing?.annualAmount?.toString() ?? "");
    setFrequency(editing?.frequency ?? "quarterly");
    setIsIrregular(editing?.isIrregular ?? false);
    setUseToRepay(editing?.useToRepay ?? true);
  };

  const handleTypeChange = (t: IncomeSource["type"]) => {
    setType(t);
    if (!name || Object.values(incomeTypeConfig).some((c) => c.label === name)) {
      setName(incomeTypeConfig[t].label);
    }
  };

  const handleSubmit = () => {
    let monthly = parseFloat(monthlyAmount) || 0;
    // For dividends, derive monthly from annual
    if (type === "dividend" && annualAmount) {
      monthly = parseFloat(annualAmount) / 12;
    }

    const source: IncomeSource = {
      id: editing?.id ?? generateId(),
      type,
      name: name || incomeTypeConfig[type].label,
      monthlyAmount: monthly,
      annualAmount: type === "dividend" ? parseFloat(annualAmount) || undefined : undefined,
      frequency: type === "dividend" ? frequency : undefined,
      isIrregular: type === "freelance" ? isIrregular : undefined,
      useToRepay,
    };
    onSubmit(source);
    onClose();
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 h-[90vh] md:right-0 md:top-0 md:h-full md:w-[480px] bg-surface-light border-l border-border-light shadow-2xl z-50 flex flex-col animate-slide-in rounded-t-2xl md:rounded-none">
        {/* Mobile drag handle */}
        <div className="md:hidden w-8 h-1 bg-[#E4D9C8] rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 md:p-6 py-4 border-b border-border-light">
          <h2 className="text-xl md:text-2xl font-bold">{editing ? "Edit income" : "Add income source"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-background-light rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 md:p-6 py-4 space-y-6 pb-24 md:pb-6">
          {/* Type selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-2 block">
              Income type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(incomeTypeConfig) as IncomeSource["type"][]).map((t) => {
                const cfg = incomeTypeConfig[t];
                const selected = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => handleTypeChange(t)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors text-sm font-medium ${
                      selected
                        ? `${cfg.bg} border-current ${cfg.fg}`
                        : "border-border-light text-text-muted-light hover:bg-background-light"
                    }`}
                  >
                    {cfg.icon}
                    <span className="text-[11px] text-center leading-tight">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-2 block">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Full-time job"
              className="w-full px-4 h-12 md:h-11 rounded-xl border border-border-light bg-background-light text-text-main-light outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Amount — varies by type */}
          {type === "dividend" ? (
            <>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-2 block">
                  Estimated annual amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted-light font-medium">{currencySymbol}</span>
                  <input
                    type="number"
                    value={annualAmount}
                    onChange={(e) => setAnnualAmount(e.target.value)}
                    placeholder="2,400"
                    className="w-full pl-8 pr-4 h-12 md:h-11 rounded-xl border border-border-light bg-background-light text-text-main-light outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                {annualAmount && parseFloat(annualAmount) > 0 && (
                  <div className="text-xs text-text-muted-light mt-1.5">
                    ≈ {formatCurrency(parseFloat(annualAmount) / 12, currency)}/mo
                  </div>
                )}
              </div>

              {/* Frequency */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-2 block">
                  Payout frequency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["monthly", "quarterly", "annual"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFrequency(f)}
                      className={`py-2.5 h-12 md:h-11 rounded-xl border-2 text-sm font-medium capitalize transition-colors ${
                        frequency === f
                          ? "border-primary bg-[#f2e7da] text-primary"
                          : "border-border-light text-text-muted-light hover:bg-background-light"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-2 block">
                {type === "salary" ? "Monthly salary (after tax)" : "Monthly amount"}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted-light font-medium">{currencySymbol}</span>
                <input
                  type="number"
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(e.target.value)}
                  placeholder="5,000"
                  className="w-full pl-8 pr-4 h-12 md:h-11 rounded-xl border border-border-light bg-background-light text-text-main-light outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}

          {/* Irregular toggle — freelance */}
          {type === "freelance" && (
            <div className="flex items-center justify-between p-4 bg-background-light rounded-xl border border-border-light">
              <div>
                <div className="font-medium text-sm">Irregular income</div>
                <div className="text-xs text-text-muted-light mt-0.5">
                  Amount varies month to month
                </div>
              </div>
              <button
                onClick={() => setIsIrregular(!isIrregular)}
                className={`transition-colors ${isIrregular ? "text-primary" : "text-text-muted-light"}`}
              >
                {isIrregular ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
              </button>
            </div>
          )}

          {/* Use to repay toggle — all income types */}
          <div className="flex items-center justify-between p-4 bg-background-light rounded-xl border border-border-light">
            <div>
              <div className="font-medium text-sm">Use for loan repayment</div>
              <div className="text-xs text-text-muted-light mt-0.5">
                Include this income in monthly surplus calculations
              </div>
            </div>
            <button
              onClick={() => setUseToRepay(!useToRepay)}
              className={`transition-colors ${useToRepay ? "text-sage" : "text-text-muted-light"}`}
            >
              {useToRepay ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 md:p-6 py-4 border-t border-border-light flex gap-3 pb-safe">
          <button
            onClick={() => { onClose(); resetForm(); }}
            className="flex-1 h-12 md:h-11 rounded-xl border border-border-light text-text-main-light font-medium hover:bg-background-light transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 h-12 md:h-11 rounded-xl bg-primary text-white font-medium hover:bg-opacity-90 transition-opacity"
          >
            {editing ? "Save changes" : "Add income"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Main Page                                                         */
/* ═══════════════════════════════════════════════════════════════════ */
export default function AssetsPage() {
  const { assets, incomeSources, totalMonthlyEMI, totalMonthlyIncome, monthlySurplus, isLoading, isHydrated } = useFinancialData();
  const currency = useAppStore((s) => s.currency);
  const currencySymbol = CURRENCY_SYMBOLS[currency];
  const addAsset = useAppStore((s) => s.addAsset);
  const updateAsset = useAppStore((s) => s.updateAsset);
  const removeAsset = useAppStore((s) => s.removeAsset);
  const addIncomeSource = useAppStore((s) => s.addIncomeSource);
  const updateIncomeSource = useAppStore((s) => s.updateIncomeSource);
  const removeIncomeSource = useAppStore((s) => s.removeIncomeSource);
  const hydrateFromSupabase = useAppStore((s) => s.hydrateFromSupabase);

  useEffect(() => {
    if (!isHydrated) hydrateFromSupabase();
  }, [isHydrated, hydrateFromSupabase]);

  const [activeTab, setActiveTab] = useState<"assets" | "income">("assets");

  // Drawer state
  const [assetDrawerOpen, setAssetDrawerOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [incomeDrawerOpen, setIncomeDrawerOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeSource | null>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Use shared surplus from the hook
  const surplus = monthlySurplus;
  const surplusPositive = surplus >= 0;

  // Total asset value
  const totalAssetValue = useMemo(() => assets.reduce((s, a) => s + a.value, 0), [assets]);
  const repayableValue = useMemo(
    () => assets.filter((a) => a.useToRepay).reduce((s, a) => s + a.value, 0),
    [assets]
  );

  const handleDeleteAsset = (id: string) => {
    if (confirmDelete === id) {
      removeAsset(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const handleDeleteIncome = (id: string) => {
    if (confirmDelete === id) {
      removeIncomeSource(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const handleToggleRepay = (asset: Asset) => {
    updateAsset({ ...asset, useToRepay: !asset.useToRepay });
  };

  const handleToggleIncomeRepay = (source: IncomeSource) => {
    updateIncomeSource({ ...source, useToRepay: !source.useToRepay });
  };

  if (isLoading) {
    return (
      <div className="bg-background-light text-text-main-light min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted-light">Loading your assets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light text-text-main-light min-h-screen flex">
      {/* ─── Sidebar ─── */}
      <AppNavigation />

      {/* ─── Main Content ─── */}
      <main className="flex-1 px-4 py-6 md:px-9 md:py-8 pb-24 md:pb-8 overflow-y-auto">
        <div className="max-w-[900px] mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 md:mb-8">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">Assets & Income</h1>
              <p className="text-sm md:text-lg text-text-muted-light">
                {assets.length} asset{assets.length !== 1 ? "s" : ""} · {formatCurrency(totalAssetValue, currency)} total
                {" · "}{incomeSources.length} income source{incomeSources.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() => {
                if (activeTab === "assets") {
                  setEditingAsset(null);
                  setAssetDrawerOpen(true);
                } else {
                  setEditingIncome(null);
                  setIncomeDrawerOpen(true);
                }
              }}
              className="flex items-center justify-center gap-2 bg-primary text-white px-5 h-12 md:h-10 rounded-xl font-medium hover:bg-opacity-90 transition-opacity w-full md:w-auto text-sm md:text-base"
            >
              <Plus size={18} />
              {activeTab === "assets" ? "Add asset" : "Add income"}
            </button>
          </div>

          {/* ─── Tabs ─── */}
          <div className="flex gap-1 bg-surface-light border border-border-light rounded-2xl p-1.5 mb-6 md:mb-8">
            <button
              onClick={() => setActiveTab("assets")}
              className={`flex-1 h-12 md:h-11 rounded-xl text-sm md:text-base font-medium transition-colors ${
                activeTab === "assets"
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted-light hover:text-text-main-light"
              }`}
            >
              Assets ({assets.length})
            </button>
            <button
              onClick={() => setActiveTab("income")}
              className={`flex-1 h-12 md:h-11 rounded-xl text-sm md:text-base font-medium transition-colors ${
                activeTab === "income"
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted-light hover:text-text-main-light"
              }`}
            >
              Income ({incomeSources.length})
            </button>
          </div>

          {/* ═══════ Assets Tab ═══════ */}
          {activeTab === "assets" && (
            <>
              {/* Repayable summary */}
              {repayableValue > 0 && (
                <div className="bg-[#E8F0EA] border border-[#bdd4c1] rounded-[20px] p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs md:text-sm font-bold text-[#5A7C60] uppercase tracking-wider">
                      Available for loan repayment
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-[#3a5a3e] mt-1">
                      {formatCurrency(repayableValue, currency)}
                    </div>
                  </div>
                  <div className="text-xs md:text-sm text-[#5A7C60]">
                    {assets.filter((a) => a.useToRepay).length} asset{assets.filter((a) => a.useToRepay).length !== 1 ? "s" : ""} earmarked
                  </div>
                </div>
              )}

              {assets.length === 0 ? (
                <div className="bg-surface-light border border-border-light rounded-[20px] p-6 md:p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#f2e7da] flex items-center justify-center mx-auto mb-4">
                    <TrendingUp size={28} className="text-primary" />
                  </div>
                  <h3 className="text-lg md:text-xl font-medium mb-2">No assets yet</h3>
                  <p className="text-sm md:text-base text-text-muted-light mb-6">
                    Add your assets to see how they can accelerate your loan payoff
                  </p>
                  <button
                    onClick={() => { setEditingAsset(null); setAssetDrawerOpen(true); }}
                    className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 h-12 md:h-10 rounded-xl font-medium hover:bg-opacity-90 transition-opacity w-full md:w-auto text-sm md:text-base"
                  >
                    <Plus size={18} />
                    Add your first asset
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  {assets.map((asset) => {
                    const cfg = assetTypeConfig[asset.type];
                    const isConfirm = confirmDelete === asset.id;

                    return (
                      <div
                        key={asset.id}
                        className="bg-surface-light border border-border-light rounded-[20px] p-5 md:p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
                      >
                        {/* Top row */}
                        <div className="flex items-start gap-3 md:gap-4 mb-4">
                          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${cfg.bg} flex items-center justify-center ${cfg.fg} flex-shrink-0`}>
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-base md:text-lg truncate">{asset.name}</h3>
                            <p className="text-xs md:text-sm text-text-muted-light mt-0.5">{cfg.label}</p>
                          </div>
                        </div>

                        {/* Value + details */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <div className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1">
                              {asset.type === "fd" ? "Principal" : "Value"}
                            </div>
                            <div className="text-lg md:text-xl font-bold">{formatCurrency(asset.value, currency)}</div>
                          </div>
                          {asset.type !== "savings" && (
                            <div>
                              <div className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1">
                                {asset.type === "fd" ? "Interest" : "Return"}
                              </div>
                              <div className="text-lg md:text-xl font-bold text-text-muted-light">
                                {asset.returnRate}%
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Extra details */}
                        {asset.maturityDate && (
                          <div className="text-xs md:text-sm text-text-muted-light mb-3">
                            Matures: {new Date(asset.maturityDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </div>
                        )}
                        {asset.sipAmount && (
                          <div className="text-xs md:text-sm text-text-muted-light mb-3">
                            SIP: {formatCurrency(asset.sipAmount, currency)}/mo
                          </div>
                        )}

                        {/* Use to repay toggle */}
                        <div className="flex items-center justify-between py-3 px-4 bg-background-light rounded-xl mb-4">
                          <span className="text-xs md:text-sm font-medium">Use to repay loan</span>
                          <button
                            onClick={() => handleToggleRepay(asset)}
                            className={`transition-colors ${asset.useToRepay ? "text-sage" : "text-text-muted-light"}`}
                          >
                            {asset.useToRepay ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-4 border-t border-border-light">
                          <button
                            onClick={() => { setEditingAsset(asset); setAssetDrawerOpen(true); }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-4 h-10 rounded-xl border border-border-light text-text-main-light text-xs md:text-sm font-medium hover:bg-background-light transition-colors"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAsset(asset.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-4 h-10 rounded-xl text-xs md:text-sm font-medium transition-colors ${
                              isConfirm
                                ? "bg-red-50 border border-red-200 text-red-600"
                                : "border border-border-light text-text-muted-light hover:text-red-500 hover:border-red-200"
                            }`}
                          >
                            <Trash2 size={14} />
                            {isConfirm ? "Confirm?" : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add card */}
                  <button
                    onClick={() => { setEditingAsset(null); setAssetDrawerOpen(true); }}
                    className="border-2 border-dashed border-border-light rounded-[20px] p-6 flex flex-col items-center justify-center gap-3 min-h-[240px] md:min-h-[280px] hover:border-primary hover:bg-[#faf6f0] transition-colors group"
                  >
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#f2e7da] flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Plus size={22} className="text-primary" />
                    </div>
                    <span className="font-medium text-sm md:text-base text-text-muted-light group-hover:text-primary transition-colors">
                      Add another asset
                    </span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* ═══════ Income Sources Tab ═══════ */}
          {activeTab === "income" && (
            <>
              {incomeSources.length === 0 ? (
                <div className="bg-surface-light border border-border-light rounded-[20px] p-6 md:p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#f2e7da] flex items-center justify-center mx-auto mb-4">
                    <Briefcase size={28} className="text-primary" />
                  </div>
                  <h3 className="text-lg md:text-xl font-medium mb-2">No income sources yet</h3>
                  <p className="text-sm md:text-base text-text-muted-light mb-6">
                    Track your income to calculate your monthly surplus for extra repayments
                  </p>
                  <button
                    onClick={() => { setEditingIncome(null); setIncomeDrawerOpen(true); }}
                    className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 h-12 md:h-10 rounded-xl font-medium hover:bg-opacity-90 transition-opacity w-full md:w-auto text-sm md:text-base"
                  >
                    <Plus size={18} />
                    Add income source
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  {incomeSources.map((source) => {
                    const cfg = incomeTypeConfig[source.type];
                    const isConfirm = confirmDelete === source.id;

                    return (
                      <div
                        key={source.id}
                        className="bg-surface-light border border-border-light rounded-[20px] p-5 md:p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
                      >
                        {/* Top */}
                        <div className="flex items-start gap-3 md:gap-4 mb-4">
                          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${cfg.bg} flex items-center justify-center ${cfg.fg} flex-shrink-0`}>
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-base md:text-lg truncate">{source.name}</h3>
                            <p className="text-xs md:text-sm text-text-muted-light mt-0.5">
                              {cfg.label}
                              {source.isIrregular && (
                                <span className="ml-1.5 px-2 py-0.5 bg-[#F4EED1] text-[#8C8040] rounded-full text-[10px] font-bold uppercase">
                                  Irregular
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="mb-4">
                          <div className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1">
                            Monthly
                          </div>
                          <div className="text-lg md:text-2xl font-bold">
                            {formatCurrency(source.monthlyAmount, currency)}
                            <span className="text-xs md:text-sm font-normal text-text-muted-light">/mo</span>
                          </div>
                          {source.type === "dividend" && source.annualAmount && (
                            <div className="text-xs md:text-sm text-text-muted-light mt-1">
                              {formatCurrency(source.annualAmount, currency)}/yr · {source.frequency} payouts
                            </div>
                          )}
                        </div>

                        {/* Use to repay toggle */}
                        <div className="flex items-center justify-between py-3 px-4 bg-background-light rounded-xl mb-4">
                          <span className="text-xs md:text-sm font-medium">Use for loan repayment</span>
                          <button
                            onClick={() => handleToggleIncomeRepay(source)}
                            className={`transition-colors ${source.useToRepay ? "text-sage" : "text-text-muted-light"}`}
                          >
                            {source.useToRepay ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-4 border-t border-border-light">
                          <button
                            onClick={() => { setEditingIncome(source); setIncomeDrawerOpen(true); }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-4 h-10 rounded-xl border border-border-light text-text-main-light text-xs md:text-sm font-medium hover:bg-background-light transition-colors"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteIncome(source.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-4 h-10 rounded-xl text-xs md:text-sm font-medium transition-colors ${
                              isConfirm
                                ? "bg-red-50 border border-red-200 text-red-600"
                                : "border border-border-light text-text-muted-light hover:text-red-500 hover:border-red-200"
                            }`}
                          >
                            <Trash2 size={14} />
                            {isConfirm ? "Confirm?" : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add card */}
                  <button
                    onClick={() => { setEditingIncome(null); setIncomeDrawerOpen(true); }}
                    className="border-2 border-dashed border-border-light rounded-[20px] p-6 flex flex-col items-center justify-center gap-3 min-h-[200px] md:min-h-[240px] hover:border-primary hover:bg-[#faf6f0] transition-colors group"
                  >
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#f2e7da] flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Plus size={22} className="text-primary" />
                    </div>
                    <span className="font-medium text-sm md:text-base text-text-muted-light group-hover:text-primary transition-colors">
                      Add income source
                    </span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* ═══════ Monthly Surplus Card ═══════ */}
          <div
            className={`mt-6 md:mt-8 rounded-[20px] p-5 md:p-6 border ${
              surplusPositive
                ? "bg-[#E8F0EA] border-[#bdd4c1]"
                : "bg-[#F5E8E5] border-[#ddbcb3]"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className={`text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 ${
                  surplusPositive ? "text-[#5A7C60]" : "text-[#A65B50]"
                }`}>
                  Monthly surplus
                </div>
                <div className={`font-display text-2xl md:text-3xl font-bold ${
                  surplusPositive ? "text-[#3a5a3e]" : "text-[#8B3E33]"
                }`}>
                  {surplusPositive ? "+" : ""}{formatCurrency(surplus, currency)}
                </div>
                <div className={`text-xs md:text-sm mt-1 ${
                  surplusPositive ? "text-[#5A7C60]" : "text-[#A65B50]"
                }`}>
                  {surplusPositive
                    ? "Available for extra repayments each month"
                    : "Your EMIs exceed your income — consider refinancing"}
                </div>
              </div>

              <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-black/10">
                <div className="text-xs md:text-sm text-text-muted-light space-y-1">
                  <div className="flex justify-between sm:justify-end gap-4"><span>Income:</span> <span className="font-medium text-text-main-light">{formatCurrency(totalMonthlyIncome, currency)}</span></div>
                  <div className="flex justify-between sm:justify-end gap-4"><span>EMIs:</span> <span className="font-medium text-text-main-light">−{formatCurrency(totalMonthlyEMI, currency)}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Drawers ─── */}
      <AssetFormDrawer
        isOpen={assetDrawerOpen}
        onClose={() => { setAssetDrawerOpen(false); setEditingAsset(null); }}
        onSubmit={(a) => (editingAsset ? updateAsset(a) : addAsset(a))}
        editing={editingAsset}
        currency={currency}
        currencySymbol={currencySymbol}
      />

      <IncomeFormDrawer
        isOpen={incomeDrawerOpen}
        onClose={() => { setIncomeDrawerOpen(false); setEditingIncome(null); }}
        onSubmit={(s) => (editingIncome ? updateIncomeSource(s) : addIncomeSource(s))}
        editing={editingIncome}
        currency={currency}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}
