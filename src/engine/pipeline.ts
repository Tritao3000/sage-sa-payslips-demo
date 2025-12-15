import type { PayslipHeader } from "../schemas/payslip";
import type { NormalizedPayslip } from "../schemas/normalized";
import type { ComparisonResult } from "../schemas/change-record";
import type { FactsResult } from "../schemas/fact";
import type { NarratorConfig, NarratorResult } from "./narrator";

import { getPayslipPairForComparison, normalizePayslip } from "../utils/payslip-utils";
import { comparePayslips } from "./diff-engine";
import { generateFacts } from "./facts-generator";
import { narrateFacts, narrateFactsSimple } from "./narrator";

// ─────────────────────────────────────────────────────────────
// Pipeline Result
// ─────────────────────────────────────────────────────────────

export interface PipelineResult {
  /** Whether the pipeline succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** The two payslips being compared */
  payslips?: {
    previous: NormalizedPayslip;
    current: NormalizedPayslip;
  };

  /** Raw comparison result */
  comparison?: ComparisonResult;

  /** Generated facts */
  facts?: FactsResult;

  /** Final explanation */
  explanation?: string;

  /** LLM usage stats (if LLM was used) */
  llmUsage?: NarratorResult["usage"];
}

// ─────────────────────────────────────────────────────────────
// Full Pipeline
// ─────────────────────────────────────────────────────────────

export interface PipelineOptions {
  /** Use LLM for final narration (requires OPENAI_API_KEY) */
  useLLM?: boolean;

  /** Narrator configuration */
  narratorConfig?: NarratorConfig;

  /** Specific months to compare (otherwise uses latest 2) */
  comparePeriods?: {
    previous: { year: number; month: number };
    current: { year: number; month: number };
  };
}

/**
 * Run the full payslip comparison pipeline
 *
 * Steps:
 * 1. Filter primary payslips
 * 2. Normalize and pair for comparison
 * 3. Run diff engine
 * 4. Generate facts
 * 5. Narrate explanation (LLM or simple)
 */
export async function runPipeline(
  payslips: PayslipHeader[],
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const { useLLM = false, narratorConfig } = options;

  try {
    // Step 1 & 2: Get pair for comparison
    const pair = getPayslipPairForComparison(payslips);

    if (!pair) {
      return {
        success: false,
        error: "Not enough primary payslips to compare (need at least 2)",
      };
    }

    const [previous, current] = pair;

    // Step 3: Run diff engine
    const comparison = comparePayslips(previous, current);

    // Step 4: Generate facts
    const facts = generateFacts(comparison);

    // Step 5: Narrate
    let explanation: string;
    let llmUsage: NarratorResult["usage"] | undefined;

    if (useLLM) {
      const narratorResult = await narrateFacts(facts, narratorConfig);
      explanation = narratorResult.explanation;
      llmUsage = narratorResult.usage;
    } else {
      explanation = narrateFactsSimple(facts);
    }

    return {
      success: true,
      payslips: { previous, current },
      comparison,
      facts,
      explanation,
      llmUsage,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Convenience: Compare specific payslips
// ─────────────────────────────────────────────────────────────

/**
 * Compare two specific payslips directly
 */
export async function compareSpecificPayslips(
  previous: PayslipHeader,
  current: PayslipHeader,
  options: Omit<PipelineOptions, "comparePeriods"> = {}
): Promise<PipelineResult> {
  const { useLLM = false, narratorConfig } = options;

  try {
    const prevNormalized = normalizePayslip(previous);
    const currNormalized = normalizePayslip(current);

    const comparison = comparePayslips(prevNormalized, currNormalized);
    const facts = generateFacts(comparison);

    let explanation: string;
    let llmUsage: NarratorResult["usage"] | undefined;

    if (useLLM) {
      const narratorResult = await narrateFacts(facts, narratorConfig);
      explanation = narratorResult.explanation;
      llmUsage = narratorResult.usage;
    } else {
      explanation = narrateFactsSimple(facts);
    }

    return {
      success: true,
      payslips: { previous: prevNormalized, current: currNormalized },
      comparison,
      facts,
      explanation,
      llmUsage,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

