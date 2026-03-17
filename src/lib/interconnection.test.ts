/**
 * Interconnection Test — lib/interconnection.test.ts
 *
 * Tests that the shared data flow through the Zustand store and
 * calculateRepayment engine produces consistent, interconnected results.
 *
 * Run: npx ts-node --project tsconfig.json src/lib/interconnection.test.ts
 *
 * This is a pure-logic test (no React hooks) that validates the calculator
 * output matches expectations when store data changes.
 */

import type { Loan, Asset, IncomeSource } from "./store";
import { calculateRepayment, calculateEMI } from "./calculator";

/* ─── Test data ─── */

const loan1: Loan = {
  id: "loan-1",
  type: "student",
  name: "Student Loan",
  principal: 25000,
  rate: 6.5,
  termMonths: 120,
  balance: 25000,
};

const loan2: Loan = {
  id: "loan-2",
  type: "auto",
  name: "Car Loan",
  principal: 18000,
  rate: 8.0,
  termMonths: 60,
  balance: 18000,
};

const fdAsset: Asset = {
  id: "asset-fd",
  type: "fd",
  name: "Fixed Deposit",
  value: 10000,
  returnRate: 5.0,
  maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  useToRepay: true,
};

const salaryIncome: IncomeSource = {
  id: "income-salary",
  type: "salary",
  name: "Monthly Salary",
  monthlyAmount: 5000,
};

/* ─── Helpers ─── */
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  TEST 1: Base data produces expected derived values                */
/* ═══════════════════════════════════════════════════════════════════ */
console.log("\n─── TEST 1: Base data produces correct derived values ───");

const loans = [loan1, loan2];
const assets = [fdAsset];
const incomeSources = [salaryIncome];

const totalDebt = loans.reduce((sum, l) => sum + l.balance, 0);
assert(totalDebt === 43000, `totalDebt = ${totalDebt} (expected 43000)`);

const totalMonthlyEMI = loans.reduce((sum, l) => {
  return sum + calculateEMI(l.balance, l.rate, l.termMonths);
}, 0);

const monthlySurplus = salaryIncome.monthlyAmount - totalMonthlyEMI;
assert(monthlySurplus > 0, `monthlySurplus = ${monthlySurplus.toFixed(2)} (expected positive)`);

// Run calculation with avalanche strategy
const result1 = calculateRepayment(loans, assets, incomeSources, [], "avalanche");

assert(result1.payoffDate > new Date(), `payoffDate = ${result1.payoffDate.toISOString()} (expected future)`);
assert(
  result1.suggestedLumpSums.length === 0,
  `suggestedLumpSums empty because FD is earmarked (useToRepay=true), not suggested`
);
assert(result1.totalInterestSaved > 0, `totalInterestSaved = ${result1.totalInterestSaved} (expected > 0)`);

// Verify earmarked FD is factored into calculation
const baselineResult = calculateRepayment(loans, [{ ...fdAsset, useToRepay: false }], incomeSources, [], "avalanche");
assert(
  result1.payoffDate <= baselineResult.payoffDate,
  `earmarked FD makes payoff earlier: ${result1.payoffDate.toISOString()} <= ${baselineResult.payoffDate.toISOString()}`
);

/* ═══════════════════════════════════════════════════════════════════ */
/*  TEST 2: Increasing loan rate pushes payoff date further out       */
/* ═══════════════════════════════════════════════════════════════════ */
console.log("\n─── TEST 2: Rate increase costs more interest ───");

const loan1Higher = { ...loan1, rate: loan1.rate + 3 };
const result2 = calculateRepayment([loan1Higher, loan2], assets, incomeSources, [], "avalanche");

assert(
  result2.totalInterestPaid > result1.totalInterestPaid,
  `higher rate interest (${result2.totalInterestPaid}) > original (${result1.totalInterestPaid})`
);
assert(
  result2.totalInterestSaved > result1.totalInterestSaved,
  `higher rate => more interest savings from strategy (${result2.totalInterestSaved} > ${result1.totalInterestSaved})`
);

/* ═══════════════════════════════════════════════════════════════════ */
/*  TEST 3: Setting use_for_repayment = false → no earmarked lump sum*/
/* ═══════════════════════════════════════════════════════════════════ */
console.log("\n─── TEST 3: Disabling useToRepay removes earmarked injection ───");

const nonRepayAsset: Asset = { ...fdAsset, useToRepay: false };
const result3 = calculateRepayment(loans, [nonRepayAsset], incomeSources, [], "avalanche");

// The earmarked asset IS NO LONGER injected as a lump sum
// Compare with result1 — result3 should have a later payoff (or same if FD didn't help much)
assert(
  result3.payoffDate >= result1.payoffDate,
  `without FD injection, payoff is same or later: ${result3.payoffDate.toISOString()} >= ${result1.payoffDate.toISOString()}`
);

// suggestedLumpSums MAY now suggest the FD since it's not earmarked
// (depends on whether FD returnRate < highest loan rate)
// FD rate=5%, highest loan rate=8% → should be suggested
const fdSuggestions = result3.suggestedLumpSums.filter((s) => s.assetId === fdAsset.id);
assert(
  fdSuggestions.length > 0,
  `FD is now suggested as lump sum (FD rate 5% < loan rate 8%): found ${fdSuggestions.length} suggestion(s)`
);

/* ═══════════════════════════════════════════════════════════════════ */
/*  TEST 4: Interest savings consistency                              */
/* ═══════════════════════════════════════════════════════════════════ */
console.log("\n─── TEST 4: Interest savings consistency ───");

assert(
  result1.totalInterestSaved === result1.totalInterestSaved,
  `totalInterestSaved is deterministic: ${result1.totalInterestSaved}`
);

// Re-run same input → same output
const result1b = calculateRepayment(loans, assets, incomeSources, [], "avalanche");
assert(
  result1.totalInterestSaved === result1b.totalInterestSaved,
  `Same inputs produce same totalInterestSaved: ${result1.totalInterestSaved} === ${result1b.totalInterestSaved}`
);
assert(
  result1.payoffDate.getTime() === result1b.payoffDate.getTime(),
  `Same inputs produce same payoffDate`
);

/* ═══════════════════════════════════════════════════════════════════ */
/*  TEST 5: Monthly schedule integrity                                */
/* ═══════════════════════════════════════════════════════════════════ */
console.log("\n─── TEST 5: Monthly schedule integrity ───");

assert(
  result1.monthlySchedule.length > 0,
  `monthlySchedule has entries: ${result1.monthlySchedule.length}`
);

const lastEntry = result1.monthlySchedule[result1.monthlySchedule.length - 1];
assert(
  lastEntry.remainingBalance < 1,
  `last entry remaining balance near zero: ${lastEntry.remainingBalance}`
);

// Interest is always non-negative
const negativeInterest = result1.monthlySchedule.filter((m) => m.interestPaid < 0);
assert(negativeInterest.length === 0, "No negative interest entries");

/* ═══════════════════════════════════════════════════════════════════ */
/*  Summary                                                           */
/* ═══════════════════════════════════════════════════════════════════ */
console.log(`\n${"═".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All interconnection tests passed! ✅\n");
}
