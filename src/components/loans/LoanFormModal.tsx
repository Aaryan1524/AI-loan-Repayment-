"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { Loan } from "@/lib/store";
import { useAppStore } from "@/lib/store";
import { formatCurrency2dp, CURRENCY_SYMBOLS } from "@/lib/formatCurrency";
import {
  X,
  Home,
  GraduationCap,
  Car,
  CreditCard,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ─── Loan type config ─── */
const loanTypes = [
  {
    value: "mortgage" as const,
    label: "Home",
    icon: <Home size={18} />,
    bg: "bg-[#E8F0EA]",
    bgActive: "bg-[#E8F0EA] ring-2 ring-[#5A7C60]",
    fg: "text-[#5A7C60]",
    defaultName: "Home mortgage",
  },
  {
    value: "student" as const,
    label: "Student",
    icon: <GraduationCap size={18} />,
    bg: "bg-[#EAEAF4]",
    bgActive: "bg-[#EAEAF4] ring-2 ring-[#6B6B99]",
    fg: "text-[#6B6B99]",
    defaultName: "Student loan",
  },
  {
    value: "auto" as const,
    label: "Car",
    icon: <Car size={18} />,
    bg: "bg-[#F5E8E5]",
    bgActive: "bg-[#F5E8E5] ring-2 ring-[#A65B50]",
    fg: "text-[#A65B50]",
    defaultName: "Car loan",
  },
  {
    value: "credit_card" as const,
    label: "Personal",
    icon: <CreditCard size={18} />,
    bg: "bg-[#F4EED1]",
    bgActive: "bg-[#F4EED1] ring-2 ring-[#8C8040]",
    fg: "text-[#8C8040]",
    defaultName: "Credit card",
  },
];

/* ─── EMI calculator ─── */
function calcEMI(principal: number, annualRate: number, termMonths: number): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

/* ─── Props ─── */
interface LoanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (loan: Loan) => void;
  editingLoan?: Loan | null;
}

export default function LoanFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingLoan,
}: LoanFormModalProps) {
  const currency = useAppStore((s) => s.currency);
  const currencySymbol = CURRENCY_SYMBOLS[currency];

  /* ─── Form state ─── */
  const [type, setType] = useState<Loan["type"]>("mortgage");
  const [name, setName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [balance, setBalance] = useState("");
  const [rate, setRate] = useState("");
  const [termYears, setTermYears] = useState("");
  const [termMonths, setTermMonths] = useState("");

  // Advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [emiOverride, setEmiOverride] = useState("");
  const [hasPenalty, setHasPenalty] = useState(false);
  const [penaltyPercent, setPenaltyPercent] = useState("");
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  /* ─── Populate from editing loan ─── */
  useEffect(() => {
    if (editingLoan) {
      setType(editingLoan.type);
      setName(editingLoan.name);
      setPrincipal(String(editingLoan.principal));
      setBalance(String(editingLoan.balance));
      setRate(String(editingLoan.rate));
      const yrs = Math.floor(editingLoan.termMonths / 12);
      const mos = editingLoan.termMonths % 12;
      setTermYears(yrs > 0 ? String(yrs) : "");
      setTermMonths(mos > 0 ? String(mos) : "");
      setEmiOverride(editingLoan.emiOverride ? String(editingLoan.emiOverride) : "");
      setHasPenalty(!!editingLoan.prepaymentPenalty);
      setPenaltyPercent(editingLoan.prepaymentPenalty ? String(editingLoan.prepaymentPenalty) : "");
      setStartDate(editingLoan.startDate || "");
      setNotes(editingLoan.notes || "");
      if (editingLoan.emiOverride || editingLoan.prepaymentPenalty || editingLoan.startDate || editingLoan.notes) {
        setShowAdvanced(true);
      }
    } else {
      resetForm();
    }
    setErrors({});
    setTouched({});
  }, [editingLoan, isOpen]);

  const resetForm = () => {
    setType("mortgage");
    setName("");
    setPrincipal("");
    setBalance("");
    setRate("");
    setTermYears("");
    setTermMonths("");
    setShowAdvanced(false);
    setEmiOverride("");
    setHasPenalty(false);
    setPenaltyPercent("");
    setStartDate("");
    setNotes("");
    setErrors({});
    setTouched({});
  };

  /* ─── Auto-suggest name on type change ─── */
  const handleTypeChange = (newType: Loan["type"]) => {
    setType(newType);
    const config = loanTypes.find((t) => t.value === newType);
    if (config && (!name || loanTypes.some((t) => t.defaultName === name))) {
      setName(config.defaultName);
    }
  };

  /* ─── Computed EMI ─── */
  const totalTermMonths = (parseInt(termYears) || 0) * 12 + (parseInt(termMonths) || 0);
  const computedEMI = useMemo(
    () => calcEMI(parseFloat(principal) || 0, parseFloat(rate) || 0, totalTermMonths),
    [principal, rate, totalTermMonths]
  );

  /* ─── Validation ─── */
  const validate = useCallback(
    (field?: string) => {
      const errs: Record<string, string> = {};

      if (!field || field === "name") {
        if (!name.trim()) errs.name = "Loan name is required";
      }
      if (!field || field === "principal") {
        const p = parseFloat(principal);
        if (!principal || isNaN(p) || p <= 0) errs.principal = "Enter a valid amount";
      }
      if (!field || field === "balance") {
        const b = parseFloat(balance);
        if (!balance || isNaN(b) || b < 0) errs.balance = "Enter a valid balance";
      }
      if (!field || field === "rate") {
        const r = parseFloat(rate);
        if (!rate || isNaN(r) || r < 0 || r > 100) errs.rate = "Enter a valid rate (0-100)";
      }
      if (!field || field === "term") {
        if (type !== "credit_card" && totalTermMonths <= 0) errs.term = "Enter a loan term";
      }

      if (field) {
        setErrors((prev) => {
          const next = { ...prev };
          if (errs[field]) next[field] = errs[field];
          else delete next[field];
          return next;
        });
      } else {
        setErrors(errs);
      }

      return field ? !errs[field] : Object.keys(errs).length === 0;
    },
    [name, principal, balance, rate, totalTermMonths, type]
  );

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validate(field);
  };

  /* ─── Submit ─── */
  const handleSubmit = () => {
    setTouched({ name: true, principal: true, balance: true, rate: true, term: true });
    if (!validate()) return;

    const loan: Loan = {
      id: editingLoan?.id || crypto.randomUUID(),
      type,
      name: name.trim(),
      principal: parseFloat(principal),
      rate: parseFloat(rate),
      termMonths: type === "credit_card" ? 0 : totalTermMonths,
      balance: parseFloat(balance),
      ...(emiOverride ? { emiOverride: parseFloat(emiOverride) } : {}),
      ...(hasPenalty && penaltyPercent ? { prepaymentPenalty: parseFloat(penaltyPercent) } : {}),
      ...(startDate ? { startDate } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    onSubmit(loan);
    onClose();
  };

  /* ─── Render ─── */
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-[520px] bg-background-light z-50 shadow-2xl 
          flex flex-col animate-slide-in overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-border-light">
          <h2 className="font-display text-2xl font-bold">
            {editingLoan ? "Edit loan" : "Add new loan"}
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface-light transition-colors text-text-muted-light"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form body — scrollable */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* ─── Section 1: Loan Basics ─── */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-3 block">
              Loan Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {loanTypes.map((lt) => (
                <button
                  key={lt.value}
                  type="button"
                  onClick={() => handleTypeChange(lt.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all text-sm font-medium ${
                    type === lt.value ? lt.bgActive : `${lt.bg} opacity-60 hover:opacity-80`
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full ${lt.bg} flex items-center justify-center ${lt.fg}`}>
                    {lt.icon}
                  </div>
                  <span className={type === lt.value ? lt.fg : "text-text-muted-light"}>
                    {lt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Loan name */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1.5 block">
              Loan Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => handleBlur("name")}
              placeholder="e.g. Chase Student Loan"
              className={`w-full px-4 py-3 rounded-xl border bg-surface-light text-text-main-light placeholder:text-text-muted-light/50 outline-none transition-shadow focus:ring-2 focus:ring-primary/30 ${
                touched.name && errors.name ? "border-primary" : "border-border-light"
              }`}
            />
            {touched.name && errors.name && (
              <p className="text-primary text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* Principal */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1.5 block">
              Principal Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted-light font-medium">{currencySymbol}</span>
              <input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                onBlur={() => handleBlur("principal")}
                placeholder="50,000"
                className={`w-full pl-8 pr-4 py-3 rounded-xl border bg-surface-light text-text-main-light placeholder:text-text-muted-light/50 outline-none transition-shadow focus:ring-2 focus:ring-primary/30 ${
                  touched.principal && errors.principal ? "border-primary" : "border-border-light"
                }`}
              />
            </div>
            {touched.principal && errors.principal && (
              <p className="text-primary text-xs mt-1">{errors.principal}</p>
            )}
          </div>

          {/* Outstanding balance */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1.5 block">
              Current Outstanding Balance
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted-light font-medium">{currencySymbol}</span>
              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                onBlur={() => handleBlur("balance")}
                placeholder="45,000"
                className={`w-full pl-8 pr-4 py-3 rounded-xl border bg-surface-light text-text-main-light placeholder:text-text-muted-light/50 outline-none transition-shadow focus:ring-2 focus:ring-primary/30 ${
                  touched.balance && errors.balance ? "border-primary" : "border-border-light"
                }`}
              />
            </div>
            {touched.balance && errors.balance && (
              <p className="text-primary text-xs mt-1">{errors.balance}</p>
            )}
          </div>

          {/* Interest rate */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1.5 block">
              Annual Interest Rate
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                onBlur={() => handleBlur("rate")}
                placeholder="6.5"
                className={`w-full px-4 pr-10 py-3 rounded-xl border bg-surface-light text-text-main-light placeholder:text-text-muted-light/50 outline-none transition-shadow focus:ring-2 focus:ring-primary/30 ${
                  touched.rate && errors.rate ? "border-primary" : "border-border-light"
                }`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted-light font-medium">%</span>
            </div>
            {touched.rate && errors.rate && (
              <p className="text-primary text-xs mt-1">{errors.rate}</p>
            )}
          </div>

          {/* Loan term — years + months side by side */}
          {type !== "credit_card" && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1.5 block">
                Loan Term
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    type="number"
                    value={termYears}
                    onChange={(e) => setTermYears(e.target.value)}
                    onBlur={() => handleBlur("term")}
                    placeholder="5"
                    min="0"
                    className={`w-full px-4 pr-14 py-3 rounded-xl border bg-surface-light text-text-main-light placeholder:text-text-muted-light/50 outline-none transition-shadow focus:ring-2 focus:ring-primary/30 ${
                      touched.term && errors.term ? "border-primary" : "border-border-light"
                    }`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted-light text-sm">years</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={termMonths}
                    onChange={(e) => setTermMonths(e.target.value)}
                    onBlur={() => handleBlur("term")}
                    placeholder="0"
                    min="0"
                    max="11"
                    className={`w-full px-4 pr-16 py-3 rounded-xl border bg-surface-light text-text-main-light placeholder:text-text-muted-light/50 outline-none transition-shadow focus:ring-2 focus:ring-primary/30 ${
                      touched.term && errors.term ? "border-primary" : "border-border-light"
                    }`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted-light text-sm">months</span>
                </div>
              </div>
              {touched.term && errors.term && (
                <p className="text-primary text-xs mt-1">{errors.term}</p>
              )}
            </div>
          )}

          {/* ─── Section 2: Advanced (collapsible) ─── */}
          <div className="border-t border-border-light pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-sm font-bold uppercase tracking-wider text-text-muted-light hover:text-text-main-light transition-colors"
            >
              Advanced Options
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAdvanced && (
              <div className="space-y-5 mt-5 animate-fade-in">
                {/* EMI Override */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1.5 block">
                    Monthly Payment Override
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted-light font-medium">{currencySymbol}</span>
                    <input
                      type="number"
                      value={emiOverride}
                      onChange={(e) => setEmiOverride(e.target.value)}
                      placeholder={computedEMI > 0 ? formatCurrency2dp(computedEMI, currency) : "Auto-calculated"}
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-border-light bg-surface-light text-text-main-light placeholder:text-text-muted-light/50 outline-none transition-shadow focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  {computedEMI > 0 && !emiOverride && (
                    <p className="text-xs text-text-muted-light mt-1">
                      Calculated EMI: {formatCurrency2dp(computedEMI, currency)}/mo
                    </p>
                  )}
                </div>

                {/* Prepayment penalty toggle */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light">
                      Prepayment Penalty
                    </label>
                    <button
                      type="button"
                      onClick={() => setHasPenalty(!hasPenalty)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        hasPenalty ? "bg-primary" : "bg-border-light"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${
                          hasPenalty ? "translate-x-[22px]" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                  {hasPenalty && (
                    <div className="relative animate-fade-in">
                      <input
                        type="number"
                        step="0.1"
                        value={penaltyPercent}
                        onChange={(e) => setPenaltyPercent(e.target.value)}
                        placeholder="2.0"
                        className="w-full px-4 pr-10 py-3 rounded-xl border border-border-light bg-surface-light text-text-main-light placeholder:text-text-muted-light/50 outline-none transition-shadow focus:ring-2 focus:ring-primary/30"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted-light font-medium">%</span>
                    </div>
                  )}
                </div>

                {/* Start date */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1.5 block">
                    Loan Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border-light bg-surface-light text-text-main-light outline-none transition-shadow focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1.5 block">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes about this loan..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-border-light bg-surface-light text-text-main-light placeholder:text-text-muted-light/50 outline-none transition-shadow focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-border-light bg-background-light flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-xl border border-border-light text-text-main-light font-medium hover:bg-surface-light transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-opacity-90 transition-opacity"
          >
            {editingLoan ? "Save changes" : "Add loan"}
          </button>
        </div>
      </div>
    </>
  );
}
