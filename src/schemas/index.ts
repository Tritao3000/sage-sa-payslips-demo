// Tax Type
export {
  TaxTypeCode,
  TaxTypeSchema,
  taxTypeToCode,
  codeToTaxType,
  type TaxType,
} from "./tax-type";

// Payslip schemas
export {
  EarningLineSchema,
  DeductionLineSchema,
  FringeBenefitLineSchema,
  CompanyContributionLineSchema,
  PayslipHeaderSchema,
  EmployeeInfoSchema,
  PayslipResponseSchema,
  type EarningLine,
  type DeductionLine,
  type FringeBenefitLine,
  type CompanyContributionLine,
  type PayslipHeader,
  type EmployeeInfo,
  type PayslipResponse,
} from "./payslip";

// Normalized schemas (for comparison)
export {
  NormalizedLineSchema,
  PeriodSchema,
  NormalizedPayslipSchema,
  periodKey,
  comparePeriods,
  isConsecutiveMonth,
  type NormalizedLine,
  type Period,
  type NormalizedPayslip,
} from "./normalized";

// Change Record schemas (diff output)
export {
  ChangeDirectionSchema,
  ChangeCategorySchema,
  ImportanceLevelSchema,
  ChangeRecordSchema,
  ComparisonResultSchema,
  getChangeDirection,
  calculatePercentChange,
  determineImportance,
  type ChangeDirection,
  type ChangeCategory,
  type ImportanceLevel,
  type ChangeRecord,
  type ComparisonResult,
} from "./change-record";

// Fact schemas (natural language output)
export {
  FactTypeSchema,
  FactSchema,
  FactsResultSchema,
  type FactType,
  type Fact,
  type FactsResult,
} from "./fact";

