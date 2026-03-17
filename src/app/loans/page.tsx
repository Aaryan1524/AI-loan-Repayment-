"use client";

import { useState, useEffect } from "react";
import AppNavigation from "../../components/layout/AppNavigation";
import { useAppStore, type Loan } from "@/lib/store";
import LoanFormModal from "@/components/loans/LoanFormModal";
import { useFinancialData } from "@/hooks/useFinancialData";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  Trash2,
  GraduationCap,
  Car,
  CreditCard,
  Home,
  Wallet,
  Plus,
  Pencil,
} from "lucide-react";
/* ─── Icon mapping ─── */
const loanIcons: Record<string, { icon: React.ReactNode; bg: string; fg: string; ring: string }> = {
  mortgage: {
    icon: <Home size={20} />,
    bg: "bg-[#E8F0EA]",
    fg: "text-[#5A7C60]",
    ring: "ring-[#E8F0EA]",
  },
  student: {
    icon: <GraduationCap size={20} />,
    bg: "bg-[#EAEAF4]",
    fg: "text-[#6B6B99]",
    ring: "ring-[#EAEAF4]",
  },
  auto: {
    icon: <Car size={20} />,
    bg: "bg-[#F5E8E5]",
    fg: "text-[#A65B50]",
    ring: "ring-[#F5E8E5]",
  },
  credit_card: {
    icon: <CreditCard size={20} />,
    bg: "bg-[#F4EED1]",
    fg: "text-[#8C8040]",
    ring: "ring-[#F4EED1]",
  },
  personal: {
    icon: <Wallet size={20} />,
    bg: "bg-[#E8EAF0]",
    fg: "text-[#5A607C]",
    ring: "ring-[#E8EAF0]",
  },
  other: {
    icon: <Wallet size={20} />,
    bg: "bg-[#E8EAF0]",
    fg: "text-[#5A607C]",
    ring: "ring-[#E8EAF0]",
  },
};


function formatTerm(months: number) {
  if (months === 0) return "Revolving";
  const yrs = Math.floor(months / 12);
  const mo = months % 12;
  if (yrs === 0) return `${mo} months`;
  if (mo === 0) return `${yrs} years`;
  return `${yrs}y ${mo}m`;
}

export default function LoansPage() {
  const { loans, isLoading, isHydrated } = useFinancialData();
  const addLoan = useAppStore((s) => s.addLoan);
  const updateLoan = useAppStore((s) => s.updateLoan);
  const currency = useAppStore((s) => s.currency);
  const removeLoan = useAppStore((s) => s.removeLoan);
  const hydrateFromSupabase = useAppStore((s) => s.hydrateFromSupabase);

  useEffect(() => {
    if (!isHydrated) hydrateFromSupabase();
  }, [isHydrated, hydrateFromSupabase]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const totalDebt = loans.reduce((sum, l) => sum + l.balance, 0);
  const avgRate = loans.length > 0
    ? (loans.reduce((sum, l) => sum + l.rate, 0) / loans.length).toFixed(1)
    : "0.0";

  const handleAdd = () => {
    setEditingLoan(null);
    setDrawerOpen(true);
  };

  const handleEdit = (loan: Loan) => {
    setEditingLoan(loan);
    setDrawerOpen(true);
  };

  const handleSubmit = (loan: Loan) => {
    if (editingLoan) {
      updateLoan(loan);
    } else {
      addLoan(loan);
    }
  };

  const handleDelete = (id: string) => {
    if (confirmDelete === id) {
      removeLoan(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      // Auto-clear confirm after 3 seconds
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-background-light text-text-main-light min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted-light">Loading your loans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light text-text-main-light min-h-screen flex">
      {/* ─── Sidebar ─── */}
      <AppNavigation />

      {/* ─── Main ─── */}
      <main className="flex-1 p-10 overflow-y-auto">
        <div className="max-w-[900px]">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">My Loans</h1>
              <p className="text-lg text-text-muted-light">
                Manage your loans — {loans.length} active · {formatCurrency(totalDebt, currency)} total · {avgRate}% avg rate
              </p>
            </div>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-medium hover:bg-opacity-90 transition-opacity"
            >
              <Plus size={18} />
              Add loan
            </button>
          </div>

          {/* ─── Loan Cards Grid ─── */}
          {loans.length === 0 ? (
            <div className="bg-surface-light border border-border-light rounded-[20px] p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-[#f2e7da] flex items-center justify-center mx-auto mb-4">
                <Wallet size={28} className="text-primary" />
              </div>
              <h3 className="text-xl font-medium mb-2">No loans yet</h3>
              <p className="text-text-muted-light mb-6">
                Add your first loan to start tracking your repayment journey
              </p>
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-opacity-90 transition-opacity"
              >
                <Plus size={18} />
                Add your first loan
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {loans.map((loan) => {
                const style = loanIcons[loan.type] ?? loanIcons.other;
                const isConfirmingDelete = confirmDelete === loan.id;

                return (
                  <div
                    key={loan.id}
                    className="bg-surface-light border border-border-light rounded-[20px] p-6 flex flex-col justify-between hover:shadow-md transition-shadow group"
                  >
                    {/* Top row: icon + info */}
                    <div className="flex items-start gap-4 mb-5">
                      <div
                        className={`w-12 h-12 rounded-full ${style.bg} flex items-center justify-center ${style.fg} flex-shrink-0`}
                      >
                        {style.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-lg truncate">{loan.name}</h3>
                        <p className="text-sm text-text-muted-light mt-0.5">
                          {loan.rate}% APR · {formatTerm(loan.termMonths)}
                        </p>
                      </div>
                    </div>

                    {/* Balance & principal */}
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1">
                          Balance
                        </div>
                        <div className="text-xl font-bold">{formatCurrency(loan.balance, currency)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-text-muted-light mb-1">
                          Principal
                        </div>
                        <div className="text-xl font-bold text-text-muted-light">
                          {formatCurrency(loan.principal, currency)}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-5">
                      <div className="flex justify-between text-xs text-text-muted-light mb-1.5">
                        <span>Paid off</span>
                        <span>
                          {loan.principal > 0
                            ? `${Math.round(((loan.principal - loan.balance) / loan.principal) * 100)}%`
                            : "0%"}
                        </span>
                      </div>
                      <div className="h-2 bg-border-light rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${loan.principal > 0 ? Math.min(((loan.principal - loan.balance) / loan.principal) * 100, 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Notes preview */}
                    {loan.notes && (
                      <p className="text-xs text-text-muted-light mb-4 line-clamp-2 italic">
                        &ldquo;{loan.notes}&rdquo;
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t border-border-light">
                      <button
                        onClick={() => handleEdit(loan)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-border-light text-text-main-light text-sm font-medium hover:bg-background-light transition-colors"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(loan.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          isConfirmingDelete
                            ? "bg-red-50 border border-red-200 text-red-600"
                            : "border border-border-light text-text-muted-light hover:text-red-500 hover:border-red-200"
                        }`}
                      >
                        <Trash2 size={14} />
                        {isConfirmingDelete ? "Confirm?" : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add new card */}
              <button
                onClick={handleAdd}
                className="border-2 border-dashed border-border-light rounded-[20px] p-6 flex flex-col items-center justify-center gap-3 min-h-[280px] hover:border-primary hover:bg-[#faf6f0] transition-colors group"
              >
                <div className="w-12 h-12 rounded-full bg-[#f2e7da] flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Plus size={22} className="text-primary" />
                </div>
                <span className="font-medium text-text-muted-light group-hover:text-primary transition-colors">
                  Add another loan
                </span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* ─── Form Drawer ─── */}
      <LoanFormModal
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingLoan(null);
        }}
        onSubmit={handleSubmit}
        editingLoan={editingLoan}
      />
    </div>
  );
}
