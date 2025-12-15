import type { PayslipHeader, EarningLine, DeductionLine } from "../schemas";
import type { NormalizedPayslip, NormalizedLine, Period } from "../schemas/normalized";
import { comparePeriods, periodKey } from "../schemas/normalized";

// ─────────────────────────────────────────────────────────────
// Primary Payslip Detection
// ─────────────────────────────────────────────────────────────

/**
 * Check if a payslip is a "primary" payslip (has basic salary > 0)
 */
export function isPrimaryPayslip(payslip: PayslipHeader): boolean {
  const salary = payslip.earnings.find((e) => e.lineCode === "SALARY");
  return salary !== undefined && salary.total > 0;
}

/**
 * Filter only primary payslips from a list
 */
export function filterPrimaryPayslips(payslips: PayslipHeader[]): PayslipHeader[] {
  return payslips.filter(isPrimaryPayslip);
}

/**
 * Get the primary payslip for a specific period
 * Returns undefined if no primary payslip exists for that period
 */
export function getPrimaryPayslipForPeriod(
  payslips: PayslipHeader[],
  year: number,
  month: number
): PayslipHeader | undefined {
  return payslips.find(
    (ps) => ps.calendarYear === year && ps.calendarMonth === month && isPrimaryPayslip(ps)
  );
}

// ─────────────────────────────────────────────────────────────
// Sorting
// ─────────────────────────────────────────────────────────────

/**
 * Sort payslips by period (oldest first)
 */
export function sortPayslipsByPeriod(payslips: PayslipHeader[]): PayslipHeader[] {
  return [...payslips].sort((a, b) => {
    if (a.calendarYear !== b.calendarYear) return a.calendarYear - b.calendarYear;
    return a.calendarMonth - b.calendarMonth;
  });
}

// ─────────────────────────────────────────────────────────────
// Normalization
// ─────────────────────────────────────────────────────────────

function normalizeEarningLine(line: EarningLine): NormalizedLine {
  return {
    code: line.lineCode,
    description: line.lineDescription,
    amount: line.total,
    taxableAmount: line.taxableAmount,
    taxDeductibleAmount: 0,
  };
}

function normalizeDeductionLine(line: DeductionLine): NormalizedLine {
  return {
    code: line.lineCode,
    description: line.lineDescription,
    amount: line.total,
    taxableAmount: 0,
    taxDeductibleAmount: line.taxDeductibleAmount,
  };
}

/**
 * Normalize a raw PayslipHeader into a NormalizedPayslip for comparison
 */
export function normalizePayslip(payslip: PayslipHeader): NormalizedPayslip {
  // Build maps
  const earnings = new Map<string, NormalizedLine>();
  const deductions = new Map<string, NormalizedLine>();
  const fringeBenefits = new Map<string, NormalizedLine>();
  const companyContributions = new Map<string, NormalizedLine>();

  for (const e of payslip.earnings) {
    earnings.set(e.lineCode, normalizeEarningLine(e));
  }

  for (const d of payslip.deductions) {
    deductions.set(d.lineCode, normalizeDeductionLine(d));
  }

  for (const fb of payslip.fringeBenefits) {
    fringeBenefits.set(fb.lineCode, {
      code: fb.lineCode,
      description: fb.lineDescription,
      amount: fb.total,
      taxableAmount: fb.taxableAmount,
      taxDeductibleAmount: 0,
    });
  }

  for (const cc of payslip.companyContributions) {
    companyContributions.set(cc.lineCode, {
      code: cc.lineCode,
      description: cc.lineDescription,
      amount: cc.total,
      taxableAmount: 0,
      taxDeductibleAmount: cc.taxDeductibleAmount,
    });
  }

  // Calculate totals
  const grossEarnings = payslip.earnings.reduce((sum, e) => sum + e.total, 0);
  const totalTaxableEarnings = payslip.earnings.reduce((sum, e) => sum + e.taxableAmount, 0);
  const totalDeductions = payslip.deductions.reduce((sum, d) => sum + d.total, 0);
  const totalTaxDeductible = payslip.deductions.reduce((sum, d) => sum + d.taxDeductibleAmount, 0);
  const totalFringeBenefits = payslip.fringeBenefits.reduce((sum, fb) => sum + fb.total, 0);
  const totalCompanyContributions = payslip.companyContributions.reduce(
    (sum, cc) => sum + cc.total,
    0
  );

  // Extract key amounts
  const basicSalary = earnings.get("SALARY")?.amount ?? 0;
  const paye = deductions.get("PAYE")?.amount ?? 0;
  const uif = deductions.get("UIF")?.amount ?? 0;
  const ot15 = earnings.get("OTIME1_5")?.amount ?? 0;
  const ot20 = earnings.get("OTIME2_0")?.amount ?? 0;
  const travel = earnings.get("TRAVEL")?.amount ?? 0;
  const commission = earnings.get("COMM")?.amount ?? 0;

  const period: Period = {
    year: payslip.calendarYear,
    month: payslip.calendarMonth,
    startDate: payslip.periodStartDate,
    endDate: payslip.periodEndDate,
  };

  return {
    payslipID: payslip.payslipID,
    employeeCode: payslip.employeeCode,
    displayName: payslip.displayName,
    period,
    taxYear: payslip.statutoryTaxYear,
    earnings,
    deductions,
    fringeBenefits,
    companyContributions,
    totals: {
      grossEarnings,
      totalTaxableEarnings,
      totalDeductions,
      totalTaxDeductible,
      totalFringeBenefits,
      totalCompanyContributions,
      netPay: payslip.netPay,
    },
    keyAmounts: {
      basicSalary,
      paye,
      uif,
      overtime: ot15 + ot20,
      travel,
      commission,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Convenience: Get normalized primary payslips sorted by period
// ─────────────────────────────────────────────────────────────

/**
 * Get all primary payslips, normalized and sorted by period (oldest first)
 */
export function getNormalizedPrimaryPayslips(payslips: PayslipHeader[]): NormalizedPayslip[] {
  return sortPayslipsByPeriod(filterPrimaryPayslips(payslips)).map(normalizePayslip);
}

/**
 * Get the current and previous payslip for comparison
 * Returns [previous, current] or undefined if not enough data
 */
export function getPayslipPairForComparison(
  payslips: PayslipHeader[]
): [NormalizedPayslip, NormalizedPayslip] | undefined {
  const normalized = getNormalizedPrimaryPayslips(payslips);

  if (normalized.length < 2) {
    return undefined;
  }

  // Return last two (most recent)
  return [normalized[normalized.length - 2], normalized[normalized.length - 1]];
}

