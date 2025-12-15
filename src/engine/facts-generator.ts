import type { ComparisonResult, ChangeRecord, ChangeCategory } from "../schemas/change-record";
import type { Fact, FactType, FactsResult } from "../schemas/fact";
import type { ImportanceLevel } from "../schemas/change-record";

// ─────────────────────────────────────────────────────────────
// Formatting Helpers
// ─────────────────────────────────────────────────────────────

const CURRENCY = "ZAR";

function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${CURRENCY} ${formatted}`;
}

function formatPercent(percent: number): string {
  return `${Math.abs(percent).toFixed(1)}%`;
}

function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return months[month - 1] || `Month ${month}`;
}

// ─────────────────────────────────────────────────────────────
// Causal Relationship Map
// ─────────────────────────────────────────────────────────────

/**
 * Maps what affects what in SA payroll:
 * - Earnings affect grossEarnings and totalTaxableEarnings
 * - Taxable earnings affect PAYE
 * - PAYE and other deductions affect netPay
 */
const CAUSAL_RULES: Record<string, string[]> = {
  // Earnings affect these aggregates
  SALARY: ["grossEarnings", "totalTaxableEarnings"],
  "OTIME1_5": ["grossEarnings", "totalTaxableEarnings"],
  "OTIME2_0": ["grossEarnings", "totalTaxableEarnings"],
  COMM: ["grossEarnings", "totalTaxableEarnings"],
  TRAVEL: ["grossEarnings", "totalTaxableEarnings"],

  // Aggregates affect these
  grossEarnings: ["netPay"],
  totalTaxableEarnings: ["PAYE"],
  totalDeductions: ["netPay"],

  // Deductions affect net pay
  PAYE: ["netPay"],
  UIF: ["netPay"],
  ADVANCE: ["netPay"],
};

/** Get what a change affects downstream */
function getAffectedBy(code: string): string[] {
  return CAUSAL_RULES[code] || [];
}

/** Check if change A could have caused change B */
function couldHaveCaused(causeCode: string, effectCode: string): boolean {
  const affects = getAffectedBy(causeCode);
  return affects.includes(effectCode);
}

// ─────────────────────────────────────────────────────────────
// Sentence Templates
// ─────────────────────────────────────────────────────────────

function generateNetPaySentence(change: ChangeRecord): string {
  const delta = formatCurrency(change.delta);
  if (change.direction === "increase") {
    return `Your net pay increased by ${delta} this month.`;
  } else if (change.direction === "decrease") {
    return `Your net pay decreased by ${delta} this month.`;
  }
  return `Your net pay remained the same this month.`;
}

function generateEarningChangeSentence(change: ChangeRecord): string {
  const delta = formatCurrency(Math.abs(change.delta));
  const percent = change.percentChange ? ` (${formatPercent(change.percentChange)})` : "";

  if (change.direction === "increase") {
    return `${change.label} increased by ${delta}${percent}.`;
  } else if (change.direction === "decrease") {
    return `${change.label} decreased by ${delta}${percent}.`;
  } else if (change.direction === "added") {
    return `You received ${change.label} of ${formatCurrency(change.newValue)} this month.`;
  } else if (change.direction === "removed") {
    return `${change.label} was not paid this month (previously ${formatCurrency(change.oldValue)}).`;
  }
  return `${change.label} remained unchanged at ${formatCurrency(change.newValue)}.`;
}

function generateDeductionChangeSentence(change: ChangeRecord): string {
  const delta = formatCurrency(Math.abs(change.delta));
  const percent = change.percentChange ? ` (${formatPercent(change.percentChange)})` : "";

  if (change.direction === "increase") {
    return `${change.label} increased by ${delta}${percent}.`;
  } else if (change.direction === "decrease") {
    return `${change.label} decreased by ${delta}${percent}.`;
  } else if (change.direction === "added") {
    return `A new deduction for ${change.label} of ${formatCurrency(change.newValue)} was applied.`;
  } else if (change.direction === "removed") {
    return `${change.label} deduction was removed (previously ${formatCurrency(change.oldValue)}).`;
  }
  return `${change.label} remained unchanged at ${formatCurrency(change.newValue)}.`;
}

function generateTaxImpactSentence(change: ChangeRecord): string {
  const delta = formatCurrency(Math.abs(change.delta));

  if (change.code === "PAYE") {
    if (change.direction === "increase") {
      return `Your PAYE tax increased by ${delta} due to higher taxable earnings.`;
    } else if (change.direction === "decrease") {
      return `Your PAYE tax decreased by ${delta} due to lower taxable earnings.`;
    }
  }

  if (change.code === "UIF") {
    if (change.direction === "increase") {
      return `Your UIF contribution increased by ${delta}.`;
    } else if (change.direction === "decrease") {
      return `Your UIF contribution decreased by ${delta}.`;
    }
  }

  return generateDeductionChangeSentence(change);
}

function generateCausalSentence(
  cause: ChangeRecord,
  effect: ChangeRecord
): string {
  const causeDirection = cause.direction === "increase" ? "increased" : "decreased";
  const effectDirection = effect.direction === "increase" ? "increased" : "decreased";

  // Specific causal explanations
  if (cause.code === "SALARY" && effect.code === "PAYE") {
    return `Because your Basic Salary ${causeDirection}, your PAYE tax also ${effectDirection}.`;
  }

  if (cause.category === "earning" && effect.code === "grossEarnings") {
    return `Your ${cause.label} change contributed to the overall change in gross earnings.`;
  }

  if (cause.code === "totalTaxableEarnings" && effect.code === "PAYE") {
    return `Your PAYE tax ${effectDirection} because your taxable earnings ${causeDirection}.`;
  }

  if (cause.code === "PAYE" && effect.code === "netPay") {
    const payeAmount = formatCurrency(Math.abs(cause.delta));
    if (cause.direction === "increase") {
      return `The increase in PAYE (${payeAmount}) reduced your net pay.`;
    } else {
      return `The decrease in PAYE (${payeAmount}) increased your net pay.`;
    }
  }

  if (cause.code === "ADVANCE" && effect.code === "netPay") {
    return `An advance deduction of ${formatCurrency(cause.newValue)} significantly impacted your net pay.`;
  }

  // Generic causal
  return `The change in ${cause.label} affected your ${effect.label}.`;
}

// ─────────────────────────────────────────────────────────────
// Fact Generation
// ─────────────────────────────────────────────────────────────

function changeToFactType(change: ChangeRecord): FactType {
  if (change.code === "netPay") return "net_pay_change";

  if (change.code === "PAYE" || change.code === "UIF") return "tax_impact";

  if (change.category === "earning") {
    if (change.direction === "added") return "earning_added";
    if (change.direction === "removed") return "earning_removed";
    return "earning_change";
  }

  if (change.category === "deduction") {
    if (change.direction === "added") return "deduction_added";
    if (change.direction === "removed") return "deduction_removed";
    return "deduction_change";
  }

  return "summary";
}

function generateFactFromChange(change: ChangeRecord): Fact {
  const type = changeToFactType(change);

  let sentence: string;
  switch (type) {
    case "net_pay_change":
      sentence = generateNetPaySentence(change);
      break;
    case "tax_impact":
      sentence = generateTaxImpactSentence(change);
      break;
    case "earning_change":
    case "earning_added":
    case "earning_removed":
      sentence = generateEarningChangeSentence(change);
      break;
    case "deduction_change":
    case "deduction_added":
    case "deduction_removed":
      sentence = generateDeductionChangeSentence(change);
      break;
    default:
      sentence = `${change.label} changed from ${formatCurrency(change.oldValue)} to ${formatCurrency(change.newValue)}.`;
  }

  return {
    id: `fact:${change.id}`,
    type,
    importance: change.importance,
    sentence,
    values: {
      amount: change.newValue,
      delta: change.delta,
      percentChange: change.percentChange,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Causal Facts Generation
// ─────────────────────────────────────────────────────────────

function generateCausalFacts(changes: ChangeRecord[]): Fact[] {
  const causalFacts: Fact[] = [];
  const changesByCode = new Map<string, ChangeRecord>();

  for (const change of changes) {
    changesByCode.set(change.code, change);
  }

  // Look for causal relationships
  for (const cause of changes) {
    const affects = getAffectedBy(cause.code);

    for (const effectCode of affects) {
      const effect = changesByCode.get(effectCode);
      if (effect && effect.direction !== "unchanged") {
        // Don't duplicate - only add causal fact if it adds insight
        const sentence = generateCausalSentence(cause, effect);

        causalFacts.push({
          id: `causal:${cause.code}->${effect.code}`,
          type: "causal",
          importance: "medium",
          sentence,
          relatedChangeIds: [cause.id, effect.id],
        });
      }
    }
  }

  return causalFacts;
}

// ─────────────────────────────────────────────────────────────
// Main Facts Generator
// ─────────────────────────────────────────────────────────────

/**
 * Generate all facts from a comparison result
 */
export function generateFacts(comparison: ComparisonResult): FactsResult {
  const facts: Fact[] = [];

  // Generate facts from changes (skip aggregates to avoid duplication)
  const relevantChanges = comparison.changes.filter(
    (c) => c.category !== "aggregate" || c.code === "netPay"
  );

  for (const change of relevantChanges) {
    facts.push(generateFactFromChange(change));
  }

  // Generate causal facts
  const causalFacts = generateCausalFacts(comparison.changes);
  facts.push(...causalFacts);

  // Sort: high importance first, then by type priority
  const typePriority: Record<FactType, number> = {
    net_pay_change: 0,
    summary: 1,
    causal: 2,
    tax_impact: 3,
    earning_change: 4,
    earning_added: 5,
    earning_removed: 6,
    deduction_change: 7,
    deduction_added: 8,
    deduction_removed: 9,
    no_change: 10,
  };

  facts.sort((a, b) => {
    const importanceOrder = { high: 0, medium: 1, low: 2 };
    const impDiff = importanceOrder[a.importance] - importanceOrder[b.importance];
    if (impDiff !== 0) return impDiff;
    return typePriority[a.type] - typePriority[b.type];
  });

  // Generate period description
  const prevMonth = getMonthName(comparison.previousPeriod.month);
  const currMonth = getMonthName(comparison.currentPeriod.month);
  const year = comparison.currentPeriod.year;
  const periodDescription = `Changes from ${prevMonth} to ${currMonth} ${year}`;

  // Generate key takeaway
  const netPayFact = facts.find((f) => f.type === "net_pay_change");
  const keyTakeaway = netPayFact?.sentence || "No significant changes this month.";

  return {
    periodDescription,
    employeeName: comparison.displayName,
    facts,
    keyTakeaway,
  };
}

// ─────────────────────────────────────────────────────────────
// Filtered Getters
// ─────────────────────────────────────────────────────────────

/** Get only the most important facts (for summary) */
export function getKeyFacts(result: FactsResult, limit = 5): Fact[] {
  return result.facts.slice(0, limit);
}

/** Get facts by type */
export function getFactsByType(result: FactsResult, type: FactType): Fact[] {
  return result.facts.filter((f) => f.type === type);
}

/** Get all causal explanations */
export function getCausalFacts(result: FactsResult): Fact[] {
  return result.facts.filter((f) => f.type === "causal");
}

/** Get all sentences as a single array (for LLM input) */
export function getAllSentences(result: FactsResult): string[] {
  return result.facts.map((f) => f.sentence);
}

