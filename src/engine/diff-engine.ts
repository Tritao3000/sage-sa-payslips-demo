import type { NormalizedPayslip, NormalizedLine } from "../schemas/normalized";
import type {
  ChangeRecord,
  ChangeCategory,
  ComparisonResult,
} from "../schemas/change-record";
import {
  getChangeDirection,
  calculatePercentChange,
  determineImportance,
} from "../schemas/change-record";

// ─────────────────────────────────────────────────────────────
// Line Item Comparison
// ─────────────────────────────────────────────────────────────

function compareLineMaps(
  category: ChangeCategory,
  oldMap: Map<string, NormalizedLine>,
  newMap: Map<string, NormalizedLine>
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];
  const allCodes = new Set([...oldMap.keys(), ...newMap.keys()]);

  for (const code of allCodes) {
    const oldLine = oldMap.get(code);
    const newLine = newMap.get(code);

    const oldValue = oldLine?.amount ?? 0;
    const newValue = newLine?.amount ?? 0;
    const isAdded = !oldLine && !!newLine;
    const isRemoved = !!oldLine && !newLine;

    // Skip if both are 0 and unchanged
    if (oldValue === 0 && newValue === 0 && !isAdded && !isRemoved) {
      continue;
    }

    const delta = newValue - oldValue;

    // Skip if no change
    if (delta === 0 && !isAdded && !isRemoved) {
      continue;
    }

    const direction = getChangeDirection(oldValue, newValue, isAdded, isRemoved);
    const label = newLine?.description ?? oldLine?.description ?? code;

    changes.push({
      id: `${category}:${code}:amount`,
      label,
      category,
      code,
      oldValue,
      newValue,
      delta,
      percentChange: calculatePercentChange(oldValue, newValue),
      direction,
      importance: determineImportance(category, code, delta, direction),
    });
  }

  return changes;
}

// ─────────────────────────────────────────────────────────────
// Aggregate Comparison
// ─────────────────────────────────────────────────────────────

interface AggregateField {
  code: string;
  label: string;
  getValue: (ps: NormalizedPayslip) => number;
}

const AGGREGATE_FIELDS: AggregateField[] = [
  { code: "grossEarnings", label: "Gross Earnings", getValue: (ps) => ps.totals.grossEarnings },
  { code: "totalTaxableEarnings", label: "Taxable Earnings", getValue: (ps) => ps.totals.totalTaxableEarnings },
  { code: "totalDeductions", label: "Total Deductions", getValue: (ps) => ps.totals.totalDeductions },
  { code: "netPay", label: "Net Pay", getValue: (ps) => ps.totals.netPay },
  { code: "totalFringeBenefits", label: "Fringe Benefits", getValue: (ps) => ps.totals.totalFringeBenefits },
  { code: "totalCompanyContributions", label: "Company Contributions", getValue: (ps) => ps.totals.totalCompanyContributions },
];

const KEY_AMOUNT_FIELDS: AggregateField[] = [
  { code: "basicSalary", label: "Basic Salary", getValue: (ps) => ps.keyAmounts.basicSalary },
  { code: "paye", label: "PAYE Tax", getValue: (ps) => ps.keyAmounts.paye },
  { code: "uif", label: "UIF", getValue: (ps) => ps.keyAmounts.uif },
  { code: "overtime", label: "Overtime", getValue: (ps) => ps.keyAmounts.overtime },
  { code: "travel", label: "Travel Allowance", getValue: (ps) => ps.keyAmounts.travel },
  { code: "commission", label: "Commission", getValue: (ps) => ps.keyAmounts.commission },
];

function compareAggregates(
  category: ChangeCategory,
  fields: AggregateField[],
  prev: NormalizedPayslip,
  curr: NormalizedPayslip
): ChangeRecord[] {
  const changes: ChangeRecord[] = [];

  for (const field of fields) {
    const oldValue = field.getValue(prev);
    const newValue = field.getValue(curr);
    const delta = newValue - oldValue;

    // Skip if no change
    if (delta === 0) continue;

    // Skip if both are 0
    if (oldValue === 0 && newValue === 0) continue;

    const direction = getChangeDirection(oldValue, newValue, false, false);

    changes.push({
      id: `${category}:${field.code}`,
      label: field.label,
      category,
      code: field.code,
      oldValue,
      newValue,
      delta,
      percentChange: calculatePercentChange(oldValue, newValue),
      direction,
      importance: determineImportance(category, field.code, delta, direction),
    });
  }

  return changes;
}

// ─────────────────────────────────────────────────────────────
// Main Comparison Function
// ─────────────────────────────────────────────────────────────

/**
 * Compare two normalized payslips and produce all change records
 */
export function comparePayslips(
  previous: NormalizedPayslip,
  current: NormalizedPayslip
): ComparisonResult {
  const changes: ChangeRecord[] = [];

  // Compare line items
  changes.push(
    ...compareLineMaps("earning", previous.earnings, current.earnings),
    ...compareLineMaps("deduction", previous.deductions, current.deductions),
    ...compareLineMaps("fringe_benefit", previous.fringeBenefits, current.fringeBenefits),
    ...compareLineMaps("company_contribution", previous.companyContributions, current.companyContributions)
  );

  // Compare aggregates
  changes.push(...compareAggregates("aggregate", AGGREGATE_FIELDS, previous, current));

  // Compare key amounts (but avoid duplicates with line items)
  // Only add key amounts that provide additional insight (like combined overtime)
  const keyAmountChanges = compareAggregates("key_amount", KEY_AMOUNT_FIELDS, previous, current);
  for (const change of keyAmountChanges) {
    // Skip if already covered by line items (basicSalary = SALARY, etc.)
    const skipCodes = ["basicSalary", "paye", "uif", "travel", "commission"];
    if (!skipCodes.includes(change.code)) {
      changes.push(change);
    }
  }

  // Sort by importance (high first) then by absolute delta (largest first)
  changes.sort((a, b) => {
    const importanceOrder = { high: 0, medium: 1, low: 2 };
    const importanceDiff = importanceOrder[a.importance] - importanceOrder[b.importance];
    if (importanceDiff !== 0) return importanceDiff;
    return Math.abs(b.delta) - Math.abs(a.delta);
  });

  // Calculate summary
  const summary = {
    totalChanges: changes.length,
    increases: changes.filter((c) => c.direction === "increase").length,
    decreases: changes.filter((c) => c.direction === "decrease").length,
    added: changes.filter((c) => c.direction === "added").length,
    removed: changes.filter((c) => c.direction === "removed").length,
    netPayDelta: current.totals.netPay - previous.totals.netPay,
  };

  return {
    previousPeriod: {
      year: previous.period.year,
      month: previous.period.month,
    },
    currentPeriod: {
      year: current.period.year,
      month: current.period.month,
    },
    employeeCode: current.employeeCode,
    displayName: current.displayName,
    changes,
    summary,
  };
}

// ─────────────────────────────────────────────────────────────
// Filtered Getters
// ─────────────────────────────────────────────────────────────

/** Get only high-importance changes */
export function getHighImportanceChanges(result: ComparisonResult): ChangeRecord[] {
  return result.changes.filter((c) => c.importance === "high");
}

/** Get changes by category */
export function getChangesByCategory(
  result: ComparisonResult,
  category: ChangeCategory
): ChangeRecord[] {
  return result.changes.filter((c) => c.category === category);
}

/** Get only line item changes (earnings, deductions, etc.) */
export function getLineItemChanges(result: ComparisonResult): ChangeRecord[] {
  return result.changes.filter(
    (c) =>
      c.category === "earning" ||
      c.category === "deduction" ||
      c.category === "fringe_benefit" ||
      c.category === "company_contribution"
  );
}

/** Get only aggregate changes */
export function getAggregateChanges(result: ComparisonResult): ChangeRecord[] {
  return result.changes.filter((c) => c.category === "aggregate");
}

