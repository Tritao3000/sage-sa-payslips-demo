import { z } from "zod/v4";
import { ImportanceLevelSchema } from "./change-record";

// ─────────────────────────────────────────────────────────────
// Fact Type - what kind of statement this is
// ─────────────────────────────────────────────────────────────

export const FactTypeSchema = z.enum([
  "net_pay_change", // Overall net pay change
  "earning_change", // A specific earning changed
  "deduction_change", // A specific deduction changed
  "earning_added", // New earning appeared
  "earning_removed", // Earning disappeared
  "deduction_added", // New deduction appeared
  "deduction_removed", // Deduction disappeared
  "tax_impact", // PAYE/UIF change
  "causal", // Explains why something changed
  "summary", // High-level summary
  "no_change", // Something stayed the same (for context)
]);

export type FactType = z.infer<typeof FactTypeSchema>;

// ─────────────────────────────────────────────────────────────
// Fact - a single natural language statement
// ─────────────────────────────────────────────────────────────

export const FactSchema = z.object({
  /** Unique identifier linking to the source change */
  id: z.string(),

  /** Type of fact */
  type: FactTypeSchema,

  /** Importance level */
  importance: ImportanceLevelSchema,

  /** The natural language sentence */
  sentence: z.string(),

  /** Related change IDs (for causal facts) */
  relatedChangeIds: z.array(z.string()).optional(),

  /** Numeric values for reference (not for display, for LLM context) */
  values: z
    .object({
      amount: z.number().optional(),
      delta: z.number().optional(),
      percentChange: z.number().nullable().optional(),
    })
    .optional(),
});

export type Fact = z.infer<typeof FactSchema>;

// ─────────────────────────────────────────────────────────────
// Facts Result - all facts for a comparison
// ─────────────────────────────────────────────────────────────

export const FactsResultSchema = z.object({
  /** Period description */
  periodDescription: z.string(),

  /** Employee name */
  employeeName: z.string(),

  /** All generated facts */
  facts: z.array(FactSchema),

  /** Key takeaway (most important fact) */
  keyTakeaway: z.string(),
});

export type FactsResult = z.infer<typeof FactsResultSchema>;

