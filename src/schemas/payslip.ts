import { z } from "zod/v4";
import { TaxTypeSchema } from "./tax-type";

// ─────────────────────────────────────────────────────────────
// Base line item schema (shared structure)
// ─────────────────────────────────────────────────────────────

const BaseLineItemSchema = z.object({
  payslipID: z.number(),
  lineCode: z.string(),
  lineDescription: z.string(),
  taxType: TaxTypeSchema,
  taxPercentage: z.number(),
  taxCode: z.string(),
  total: z.number(),
  mtdTotal: z.number(),
  ytdTotal: z.number(),
});

// ─────────────────────────────────────────────────────────────
// Earnings - has taxableAmount
// ─────────────────────────────────────────────────────────────

export const EarningLineSchema = BaseLineItemSchema.extend({
  taxableAmount: z.number(),
});

export type EarningLine = z.infer<typeof EarningLineSchema>;

// ─────────────────────────────────────────────────────────────
// Deductions - has taxDeductibleAmount
// ─────────────────────────────────────────────────────────────

export const DeductionLineSchema = BaseLineItemSchema.extend({
  taxDeductibleAmount: z.number(),
});

export type DeductionLine = z.infer<typeof DeductionLineSchema>;

// ─────────────────────────────────────────────────────────────
// Fringe Benefits - same as earnings (has taxableAmount)
// ─────────────────────────────────────────────────────────────

export const FringeBenefitLineSchema = BaseLineItemSchema.extend({
  taxableAmount: z.number(),
});

export type FringeBenefitLine = z.infer<typeof FringeBenefitLineSchema>;

// ─────────────────────────────────────────────────────────────
// Company Contributions - has taxDeductibleAmount
// ─────────────────────────────────────────────────────────────

export const CompanyContributionLineSchema = BaseLineItemSchema.extend({
  taxDeductibleAmount: z.number(),
});

export type CompanyContributionLine = z.infer<typeof CompanyContributionLineSchema>;

// ─────────────────────────────────────────────────────────────
// Payslip Header (single payslip record)
// ─────────────────────────────────────────────────────────────

export const PayslipHeaderSchema = z.object({
  payslipID: z.number(),
  displayName: z.string(),
  employeeCode: z.string(),
  birthDate: z.string(), // ISO date string
  taxStartDate: z.string(),
  taxEndDate: z.string().nullable(),
  shortDescription: z.string(),
  periodStartDate: z.string(),
  periodEndDate: z.string(),
  calendarMonth: z.number().min(1).max(12),
  calendarYear: z.number(),
  statutoryTaxYear: z.number(),
  netPay: z.number(),
  earnings: z.array(EarningLineSchema),
  deductions: z.array(DeductionLineSchema),
  fringeBenefits: z.array(FringeBenefitLineSchema),
  companyContributions: z.array(CompanyContributionLineSchema),
});

export type PayslipHeader = z.infer<typeof PayslipHeaderSchema>;

// ─────────────────────────────────────────────────────────────
// Employee Info
// ─────────────────────────────────────────────────────────────

export const EmployeeInfoSchema = z.object({
  employeeID: z.number(),
  employeeCode: z.string(),
  idNumber: z.string(),
  birthDate: z.string(),
  maritalStatus: z.string(),
  cellNumber: z.string(),
  companyName: z.string(),
  jobTitle: z.string(),
  jobGrade: z.string(),
  jobGeneral: z.string(),
  department: z.string(),
  employeeStatus: z.string(),
  contractType: z.string(),
  dateJoinedGroup: z.string(),
  terminationDate: z.string().nullable(),
});

export type EmployeeInfo = z.infer<typeof EmployeeInfoSchema>;

// ─────────────────────────────────────────────────────────────
// Full API Response
// ─────────────────────────────────────────────────────────────

export const PayslipResponseSchema = z.object({
  success: z.boolean(),
  employeeInfo: EmployeeInfoSchema,
  payslipHeaders: z.array(PayslipHeaderSchema),
  payslipCount: z.number(),
});

export type PayslipResponse = z.infer<typeof PayslipResponseSchema>;

