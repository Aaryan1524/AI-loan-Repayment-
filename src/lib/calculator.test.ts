import { describe, it, expect, beforeAll } from "vitest";
import { calculateRepayment, type RepaymentResult } from "./calculator";
import type { Loan, Asset, IncomeSource, LumpSum } from "./store";

/* ─── Shared Fixtures ─── */

const singleLoan: Loan[] = [
  {
    id: "loan-1",
    type: "personal",
    name: "Personal loan",
    principal: 10_000,
    rate: 12.0,
    termMonths: 24,
    balance: 10_000,
  },
];

const multipleLoans: Loan[] = [
  {
    id: "loan-1",
    type: "auto",
    name: "Car loan",
    principal: 9_300,
    rate: 7.2,
    termMonths: 36,
    balance: 9_300,
  },
  {
    id: "loan-2",
    type: "credit_card",
    name: "Credit card",
    principal: 4_500,
    rate: 14.9,
    termMonths: 0,
    balance: 4_500,
  },
  {
    id: "loan-3",
    type: "student",
    name: "Student loan",
    principal: 18_400,
    rate: 4.5,
    termMonths: 84,
    balance: 18_400,
  },
];

const basicIncome: IncomeSource[] = [
  { id: "inc-1", type: "salary", name: "Salary", monthlyAmount: 5_200 },
];

const noAssets: Asset[] = [];
const noLumpSums: LumpSum[] = [];
const noIncome: IncomeSource[] = [];

/* ─── Tests ─── */

describe("calculateRepayment", () => {
  describe("Scenario 1: Single loan — baseline", () => {
    let result: RepaymentResult;

    beforeAll(() => {
      result = calculateRepayment(singleLoan, noAssets, noIncome, noLumpSums, "baseline");
    });

    it("should produce a monthly schedule", () => {
      expect(result.monthlySchedule.length).toBeGreaterThan(0);
    });

    it("should have decreasing total balance over time", () => {
      const balances = result.monthlySchedule.map((e) => e.totalBalance);
      for (let i = 1; i < balances.length; i++) {
        expect(balances[i]).toBeLessThanOrEqual(balances[i - 1]);
      }
    });

    it("should end with zero remaining balance", () => {
      const last = result.monthlySchedule[result.monthlySchedule.length - 1];
      expect(last.remainingBalance).toBeLessThan(1);
    });

    it("should report total interest > 0", () => {
      expect(result.totalInterestPaid).toBeGreaterThan(0);
    });

    it("should report zero interest saved for baseline", () => {
      expect(result.totalInterestSaved).toBe(0);
    });

    it("should have payoff date in the future", () => {
      expect(result.payoffDate.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("Scenario 2: Multiple loans — avalanche saves more interest than snowball", () => {
    let avalanche: RepaymentResult;
    let snowball: RepaymentResult;
    let baseline: RepaymentResult;

    beforeAll(() => {
      baseline = calculateRepayment(multipleLoans, noAssets, basicIncome, noLumpSums, "baseline");
      avalanche = calculateRepayment(multipleLoans, noAssets, basicIncome, noLumpSums, "avalanche");
      snowball = calculateRepayment(multipleLoans, noAssets, basicIncome, noLumpSums, "snowball");
    });

    it("avalanche should pay off faster than baseline", () => {
      expect(avalanche.monthlySchedule.length).toBeLessThan(baseline.monthlySchedule.length);
    });

    it("snowball should pay off faster than baseline", () => {
      expect(snowball.monthlySchedule.length).toBeLessThan(baseline.monthlySchedule.length);
    });

    it("avalanche should save more interest than snowball", () => {
      expect(avalanche.totalInterestSaved).toBeGreaterThanOrEqual(snowball.totalInterestSaved);
    });

    it("both strategies should end with zero balance", () => {
      const avalancheLast = avalanche.monthlySchedule[avalanche.monthlySchedule.length - 1];
      const snowballLast = snowball.monthlySchedule[snowball.monthlySchedule.length - 1];
      expect(avalancheLast.remainingBalance).toBeLessThan(1);
      expect(snowballLast.remainingBalance).toBeLessThan(1);
    });

    it("avalanche totalInterestSaved should be > 0", () => {
      expect(avalanche.totalInterestSaved).toBeGreaterThan(0);
    });
  });

  describe("Scenario 3: Lump sum injection reduces payoff time", () => {
    const futureLumpSum: LumpSum[] = [
      {
        id: "ls-1",
        // 6 months from now
        date: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .substring(0, 10),
        amount: 5_000,
        label: "Bonus",
      },
    ];

    let withoutLump: RepaymentResult;
    let withLump: RepaymentResult;

    beforeAll(() => {
      withoutLump = calculateRepayment(multipleLoans, noAssets, basicIncome, noLumpSums, "avalanche");
      withLump = calculateRepayment(multipleLoans, noAssets, basicIncome, futureLumpSum, "avalanche");
    });

    it("lump sum should reduce total schedule length", () => {
      expect(withLump.monthlySchedule.length).toBeLessThanOrEqual(
        withoutLump.monthlySchedule.length
      );
    });

    it("lump sum should reduce total interest paid", () => {
      expect(withLump.totalInterestPaid).toBeLessThan(withoutLump.totalInterestPaid);
    });

    it("lump sum should produce earlier payoff date", () => {
      expect(withLump.payoffDate.getTime()).toBeLessThanOrEqual(
        withoutLump.payoffDate.getTime()
      );
    });
  });

  describe("Scenario 4: Suggested lump sums from assets", () => {
    const fd: Asset[] = [
      {
        id: "asset-1",
        type: "fd",
        name: "FD",
        value: 8_000,
        returnRate: 5.2,
        maturityDate: new Date(Date.now() + 3 * 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .substring(0, 10),
        useToRepay: false,
      },
    ];

    let result: RepaymentResult;

    beforeAll(() => {
      result = calculateRepayment(multipleLoans, fd, basicIncome, noLumpSums, "avalanche");
    });

    it("should suggest redirecting FD since its return < highest loan rate", () => {
      expect(result.suggestedLumpSums.length).toBeGreaterThan(0);
      expect(result.suggestedLumpSums[0].assetId).toBe("asset-1");
    });

    it("suggested lump sum interestSaved should be > 0", () => {
      expect(result.suggestedLumpSums[0].interestSaved).toBeGreaterThan(0);
    });
  });
});
