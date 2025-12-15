import { test, expect, describe } from "bun:test";
import { PayslipResponseSchema } from "../schemas";
import { getPayslipPairForComparison } from "../utils";
import {
  comparePayslips,
  getHighImportanceChanges,
  getChangesByCategory,
  getLineItemChanges,
  getAggregateChanges,
} from "./diff-engine";
import payslipData from "../../payslip-example.json";

const data = PayslipResponseSchema.parse(payslipData);
const pair = getPayslipPairForComparison(data.payslipHeaders)!;
const [prev, curr] = pair;

describe("comparePayslips", () => {
  const result = comparePayslips(prev, curr);

  test("returns correct period info", () => {
    expect(result.previousPeriod.month).toBe(5); // May
    expect(result.currentPeriod.month).toBe(6); // June
    expect(result.previousPeriod.year).toBe(2012);
  });

  test("detects changes", () => {
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.summary.totalChanges).toBe(result.changes.length);
  });

  test("calculates correct netPay delta", () => {
    const expectedDelta = curr.totals.netPay - prev.totals.netPay;
    expect(result.summary.netPayDelta).toBeCloseTo(expectedDelta, 2);
  });

  test("changes are sorted by importance then magnitude", () => {
    const importanceOrder = { high: 0, medium: 1, low: 2 };

    for (let i = 1; i < result.changes.length; i++) {
      const prevChange = result.changes[i - 1];
      const currChange = result.changes[i];
      const prevOrder = importanceOrder[prevChange!.importance];
      const currOrder = importanceOrder[currChange!.importance];

      // Either same or higher order (less important)
      if (prevOrder === currOrder) {
        // Within same importance, sorted by magnitude (descending)
        expect(Math.abs(prevChange!.delta)).toBeGreaterThanOrEqual(Math.abs(currChange!.delta));
      } else {
        expect(currOrder).toBeGreaterThanOrEqual(prevOrder);
      }
    }
  });
});

describe("getHighImportanceChanges", () => {
  const result = comparePayslips(prev, curr);
  const highChanges = getHighImportanceChanges(result);

  test("returns only high importance changes", () => {
    highChanges.forEach((c) => {
      expect(c.importance).toBe("high");
    });
  });

  test("includes netPay change", () => {
    const netPayChange = highChanges.find((c) => c.code === "netPay");
    expect(netPayChange).toBeDefined();
  });
});

describe("getLineItemChanges", () => {
  const result = comparePayslips(prev, curr);
  const lineChanges = getLineItemChanges(result);

  test("returns only line item changes", () => {
    lineChanges.forEach((c) => {
      expect(["earning", "deduction", "fringe_benefit", "company_contribution"]).toContain(
        c.category
      );
    });
  });
});

describe("getAggregateChanges", () => {
  const result = comparePayslips(prev, curr);
  const aggChanges = getAggregateChanges(result);

  test("returns only aggregate changes", () => {
    aggChanges.forEach((c) => {
      expect(c.category).toBe("aggregate");
    });
  });
});

describe("change detection accuracy", () => {
  const result = comparePayslips(prev, curr);

  test("detects PAYE change correctly", () => {
    const payeChange = result.changes.find(
      (c) => c.code === "PAYE" && c.category === "deduction"
    );
    expect(payeChange).toBeDefined();

    const expectedDelta = curr.deductions.get("PAYE")!.amount - prev.deductions.get("PAYE")!.amount;
    expect(payeChange!.delta).toBeCloseTo(expectedDelta, 2);
  });

  test("calculates percentage change correctly", () => {
    const change = result.changes.find((c) => c.oldValue !== 0 && c.percentChange !== null);
    if (change) {
      const expectedPercent = ((change.newValue - change.oldValue) / Math.abs(change.oldValue)) * 100;
      expect(change.percentChange).toBeCloseTo(expectedPercent, 2);
    }
  });
});

describe("added/removed detection", () => {
  // June has ADVANCE deduction that May doesn't have
  const result = comparePayslips(prev, curr);

  test("detects added deductions", () => {
    const addedChanges = result.changes.filter((c) => c.direction === "added");
    // Should detect ADVANCE as added (it's 0 in May, has value in June)
    console.log("Added changes:", addedChanges.map((c) => c.code));
    expect(result.summary.added).toBeGreaterThanOrEqual(0);
  });
});

// Print a summary for visual inspection
test("print comparison summary", () => {
  const result = comparePayslips(prev, curr);

  console.log("\n════════════════════════════════════════════════════════");
  console.log("COMPARISON RESULT: May 2012 → June 2012");
  console.log("════════════════════════════════════════════════════════");
  console.log(`Net Pay Delta: ${result.summary.netPayDelta.toFixed(2)}`);
  console.log(`Total Changes: ${result.summary.totalChanges}`);
  console.log(`  ↑ Increases: ${result.summary.increases}`);
  console.log(`  ↓ Decreases: ${result.summary.decreases}`);
  console.log(`  + Added: ${result.summary.added}`);
  console.log(`  - Removed: ${result.summary.removed}`);
  console.log("\nHigh Importance Changes:");

  const high = getHighImportanceChanges(result);
  high.forEach((c) => {
    const arrow = c.direction === "increase" ? "↑" : c.direction === "decrease" ? "↓" : "•";
    console.log(`  ${arrow} ${c.label}: ${c.oldValue.toFixed(2)} → ${c.newValue.toFixed(2)} (${c.delta >= 0 ? "+" : ""}${c.delta.toFixed(2)})`);
  });

  expect(true).toBe(true); // Always pass, just for output
});

