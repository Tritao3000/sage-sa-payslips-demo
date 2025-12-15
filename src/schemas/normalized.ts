import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────
// Simplified line item for comparison
// ─────────────────────────────────────────────────────────────

export const NormalizedLineSchema = z.object({
  code: z.string(),
  description: z.string(),
  amount: z.number(),
  taxableAmount: z.number(), // For earnings: taxableAmount, for deductions: 0
  taxDeductibleAmount: z.number(), // For deductions: taxDeductibleAmount, for earnings: 0
});

export type NormalizedLine = z.infer<typeof NormalizedLineSchema>;

// ─────────────────────────────────────────────────────────────
// Period identifier
// ─────────────────────────────────────────────────────────────

export const PeriodSchema = z.object({
  year: z.number(),
  month: z.number().min(1).max(12),
  startDate: z.string(),
  endDate: z.string(),
});

export type Period = z.infer<typeof PeriodSchema>;

// ─────────────────────────────────────────────────────────────
// Normalized Payslip - optimized for comparison
// ─────────────────────────────────────────────────────────────

export const NormalizedPayslipSchema = z.object({
  // Identity
  payslipID: z.number(),
  employeeCode: z.string(),
  displayName: z.string(),

  // Period
  period: PeriodSchema,
  taxYear: z.number(),

  // Line items (as maps for easy lookup)
  earnings: z.map(z.string(), NormalizedLineSchema),
  deductions: z.map(z.string(), NormalizedLineSchema),
  fringeBenefits: z.map(z.string(), NormalizedLineSchema),
  companyContributions: z.map(z.string(), NormalizedLineSchema),

  // Pre-computed aggregates
  totals: z.object({
    grossEarnings: z.number(),
    totalTaxableEarnings: z.number(),
    totalDeductions: z.number(),
    totalTaxDeductible: z.number(),
    totalFringeBenefits: z.number(),
    totalCompanyContributions: z.number(),
    netPay: z.number(),
  }),

  // Key line items extracted for quick access
  keyAmounts: z.object({
    basicSalary: z.number(),
    paye: z.number(),
    uif: z.number(),
    overtime: z.number(), // Combined OT 1.5 + OT 2.0
    travel: z.number(),
    commission: z.number(),
  }),
});

export type NormalizedPayslip = z.infer<typeof NormalizedPayslipSchema>;

// ─────────────────────────────────────────────────────────────
// Period comparison helpers
// ─────────────────────────────────────────────────────────────

/** Returns a sortable string key for a period: "YYYY-MM" */
export function periodKey(period: Period): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

/** Compare two periods. Returns -1, 0, or 1 */
export function comparePeriods(a: Period, b: Period): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

/** Check if period B is the month after period A */
export function isConsecutiveMonth(a: Period, b: Period): boolean {
  if (a.month === 12) {
    return b.year === a.year + 1 && b.month === 1;
  }
  return b.year === a.year && b.month === a.month + 1;
}

