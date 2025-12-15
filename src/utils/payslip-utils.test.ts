import { test, expect, describe } from "bun:test";
import { PayslipResponseSchema } from "../schemas";
import {
  isPrimaryPayslip,
  filterPrimaryPayslips,
  sortPayslipsByPeriod,
  normalizePayslip,
  getNormalizedPrimaryPayslips,
  getPayslipPairForComparison,
} from "./payslip-utils";
import payslipData from "../../payslip-example.json";

const data = PayslipResponseSchema.parse(payslipData);
const payslips = data.payslipHeaders;

describe("isPrimaryPayslip", () => {
  test("identifies primary payslip (has salary > 0)", () => {
    const primary = payslips.find((p) => p.payslipID === 55)!;
    expect(isPrimaryPayslip(primary)).toBe(true);
  });

  test("identifies supplementary payslip (salary = 0)", () => {
    const supplementary = payslips.find((p) => p.payslipID === 167)!;
    expect(isPrimaryPayslip(supplementary)).toBe(false);
  });
});

describe("filterPrimaryPayslips", () => {
  test("filters only primary payslips", () => {
    const primaries = filterPrimaryPayslips(payslips);
    expect(primaries.length).toBe(4); // 4 months, 1 primary each
    primaries.forEach((p) => {
      expect(isPrimaryPayslip(p)).toBe(true);
    });
  });
});

describe("sortPayslipsByPeriod", () => {
  test("sorts payslips oldest first", () => {
    const sorted = sortPayslipsByPeriod(payslips);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevKey = prev!.calendarYear * 100 + prev!.calendarMonth;
      const currKey = curr!.calendarYear * 100 + curr!.calendarMonth;
      expect(currKey).toBeGreaterThanOrEqual(prevKey);
    }
  });
});

describe("normalizePayslip", () => {
  test("computes correct totals", () => {
    const primary = payslips.find((p) => p.payslipID === 55)!;
    const normalized = normalizePayslip(primary);

    expect(normalized.totals.grossEarnings).toBe(26500); // 25000 + 1500 + 0 + 0 + 0
    expect(normalized.totals.netPay).toBe(19550.95);
    expect(normalized.keyAmounts.basicSalary).toBe(25000);
    expect(normalized.keyAmounts.paye).toBe(5081.86);
  });

  test("builds earnings map correctly", () => {
    const primary = payslips.find((p) => p.payslipID === 55)!;
    const normalized = normalizePayslip(primary);

    expect(normalized.earnings.has("SALARY")).toBe(true);
    expect(normalized.earnings.get("SALARY")?.amount).toBe(25000);
    expect(normalized.earnings.has("TRAVEL")).toBe(true);
    expect(normalized.earnings.get("TRAVEL")?.amount).toBe(1500);
  });

  test("extracts period correctly", () => {
    const primary = payslips.find((p) => p.payslipID === 55)!;
    const normalized = normalizePayslip(primary);

    expect(normalized.period.year).toBe(2012);
    expect(normalized.period.month).toBe(3);
  });
});

describe("getNormalizedPrimaryPayslips", () => {
  test("returns normalized primary payslips sorted by period", () => {
    const normalized = getNormalizedPrimaryPayslips(payslips);

    expect(normalized.length).toBe(4);
    expect(normalized[0]!.period.month).toBe(3); // March first
    expect(normalized[3]!.period.month).toBe(6); // June last
  });
});

describe("getPayslipPairForComparison", () => {
  test("returns last two primary payslips", () => {
    const pair = getPayslipPairForComparison(payslips);

    expect(pair).toBeDefined();
    const [prev, curr] = pair!;

    expect(prev.period.month).toBe(5); // May
    expect(curr.period.month).toBe(6); // June
  });

  test("returns undefined if less than 2 primary payslips", () => {
    const singlePayslip = [payslips[0]!];
    const pair = getPayslipPairForComparison(singlePayslip);
    expect(pair).toBeUndefined();
  });
});

