import { z } from "zod/v4";

/**
 * Tax Type codes used in SA payroll
 * NRM = Normal (100% taxable)
 * PRD = Periodic
 * ASM = On Assessment
 * NVR = Never (not taxable)
 * CCT = Company Contribution Taxable
 * TXD = Tax Deductible
 * CRI = Criteria
 */
export const TaxTypeCode = {
  Normal: "NRM",
  Periodic: "PRD",
  OnAssessment: "ASM",
  Never: "NVR",
  CompanyContributionTaxable: "CCT",
  TaxDeductible: "TXD",
  Criteria: "CRI",
} as const;

export const TaxTypeSchema = z.enum([
  "Normal",
  "Periodic",
  "On Assessment",
  "Never",
  "CC Taxable",
  "Tax Deductible",
  "Criteria",
]);

export type TaxType = z.infer<typeof TaxTypeSchema>;

/** Maps TaxType string to code */
export const taxTypeToCode: Record<TaxType, string> = {
  Normal: "NRM",
  Periodic: "PRD",
  "On Assessment": "ASM",
  Never: "NVR",
  "CC Taxable": "CCT",
  "Tax Deductible": "TXD",
  Criteria: "CRI",
};

/** Maps code to TaxType string */
export const codeToTaxType: Record<string, TaxType> = {
  NRM: "Normal",
  PRD: "Periodic",
  ASM: "On Assessment",
  NVR: "Never",
  CCT: "CC Taxable",
  TXD: "Tax Deductible",
  CRI: "Criteria",
};

