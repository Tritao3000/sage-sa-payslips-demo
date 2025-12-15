import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────
// Change Direction
// ─────────────────────────────────────────────────────────────

export const ChangeDirectionSchema = z.enum(["increase", "decrease", "unchanged", "added", "removed"]);
export type ChangeDirection = z.infer<typeof ChangeDirectionSchema>;

// ─────────────────────────────────────────────────────────────
// Change Category - what type of item changed
// ─────────────────────────────────────────────────────────────

export const ChangeCategorySchema = z.enum([
  "earning",
  "deduction",
  "fringe_benefit",
  "company_contribution",
  "aggregate", // totals like grossEarnings, netPay
  "key_amount", // extracted amounts like basicSalary, paye
]);
export type ChangeCategory = z.infer<typeof ChangeCategorySchema>;

// ─────────────────────────────────────────────────────────────
// Importance Level - for prioritizing explanations
// ─────────────────────────────────────────────────────────────

export const ImportanceLevelSchema = z.enum(["high", "medium", "low"]);
export type ImportanceLevel = z.infer<typeof ImportanceLevelSchema>;

// ─────────────────────────────────────────────────────────────
// Change Record - a single detected change
// ─────────────────────────────────────────────────────────────

export const ChangeRecordSchema = z.object({
  /** Unique identifier for this change: "category:code:field" */
  id: z.string(),

  /** Human-readable label */
  label: z.string(),

  /** Category of the change */
  category: ChangeCategorySchema,

  /** Line code (for line items) or field name (for aggregates) */
  code: z.string(),

  /** Previous value (0 if added) */
  oldValue: z.number(),

  /** Current value (0 if removed) */
  newValue: z.number(),

  /** Absolute difference (newValue - oldValue) */
  delta: z.number(),

  /** Percentage change (null if oldValue was 0) */
  percentChange: z.number().nullable(),

  /** Direction of change */
  direction: ChangeDirectionSchema,

  /** Importance for explanation ordering */
  importance: ImportanceLevelSchema,
});

export type ChangeRecord = z.infer<typeof ChangeRecordSchema>;

// ─────────────────────────────────────────────────────────────
// Comparison Result - all changes between two payslips
// ─────────────────────────────────────────────────────────────

export const ComparisonResultSchema = z.object({
  /** Previous period info */
  previousPeriod: z.object({
    year: z.number(),
    month: z.number(),
  }),

  /** Current period info */
  currentPeriod: z.object({
    year: z.number(),
    month: z.number(),
  }),

  /** Employee info */
  employeeCode: z.string(),
  displayName: z.string(),

  /** All detected changes */
  changes: z.array(ChangeRecordSchema),

  /** Summary counts */
  summary: z.object({
    totalChanges: z.number(),
    increases: z.number(),
    decreases: z.number(),
    added: z.number(),
    removed: z.number(),
    netPayDelta: z.number(),
  }),
});

export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;

// ─────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────

/** Determine the direction of a change */
export function getChangeDirection(
  oldValue: number,
  newValue: number,
  isAdded: boolean,
  isRemoved: boolean
): ChangeDirection {
  if (isAdded) return "added";
  if (isRemoved) return "removed";
  if (newValue > oldValue) return "increase";
  if (newValue < oldValue) return "decrease";
  return "unchanged";
}

/** Calculate percentage change (null if oldValue is 0) */
export function calculatePercentChange(oldValue: number, newValue: number): number | null {
  if (oldValue === 0) return null;
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}

/** Determine importance based on category and delta magnitude */
export function determineImportance(
  category: ChangeCategory,
  code: string,
  delta: number,
  direction: ChangeDirection
): ImportanceLevel {
  // Net pay changes are always high importance
  if (code === "netPay") return "high";

  // PAYE changes are high importance
  if (code === "PAYE" || code === "paye") return "high";

  // Basic salary changes are high importance
  if (code === "SALARY" || code === "basicSalary") return "high";

  // Added/removed items are medium importance
  if (direction === "added" || direction === "removed") return "medium";

  // Aggregate totals are medium importance
  if (category === "aggregate") return "medium";

  // Small changes (< 100) are low importance
  if (Math.abs(delta) < 100) return "low";

  // Everything else is medium
  return "medium";
}

