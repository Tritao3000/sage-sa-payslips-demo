/**
 * Demo script for the payslip comparison pipeline
 *
 * Usage:
 *   bun src/demo.ts           # Without LLM (simple narration)
 *   bun src/demo.ts --llm     # With LLM (requires OPENAI_API_KEY)
 */

import { PayslipResponseSchema } from "./schemas";
import { runPipeline } from "./engine";
import payslipData from "../payslip-example.json";

const useLLM = process.argv.includes("--llm");

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  PAYSLIP COMPARISON PIPELINE DEMO");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Parse the data
  const data = PayslipResponseSchema.parse(payslipData);
  console.log(`📊 Loaded ${data.payslipCount} payslips for ${data.employeeInfo.companyName}\n`);

  // Run the pipeline
  console.log(`🔄 Running pipeline (LLM: ${useLLM ? "enabled" : "disabled"})...\n`);

  const result = await runPipeline(data.payslipHeaders, {
    useLLM,
    narratorConfig: {
      model: "gpt-4o-mini",
      temperature: 0.3,
    },
  });

  if (!result.success) {
    console.error("❌ Pipeline failed:", result.error);
    process.exit(1);
  }

  // Show comparison info
  console.log("───────────────────────────────────────────────────────────");
  console.log("COMPARISON INFO");
  console.log("───────────────────────────────────────────────────────────");
  console.log(`Previous: ${result.comparison!.previousPeriod.month}/${result.comparison!.previousPeriod.year}`);
  console.log(`Current:  ${result.comparison!.currentPeriod.month}/${result.comparison!.currentPeriod.year}`);
  console.log(`Employee: ${result.comparison!.displayName}`);
  console.log(`\nNet Pay Delta: ZAR ${result.comparison!.summary.netPayDelta.toFixed(2)}`);
  console.log(`Total Changes: ${result.comparison!.summary.totalChanges}`);

  // Show facts
  console.log("\n───────────────────────────────────────────────────────────");
  console.log("GENERATED FACTS");
  console.log("───────────────────────────────────────────────────────────");
  result.facts!.facts.forEach((f, i) => {
    const icon = f.importance === "high" ? "🔴" : f.importance === "medium" ? "🟡" : "🟢";
    console.log(`${i + 1}. ${icon} ${f.sentence}`);
  });

  // Show final explanation
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("FINAL EXPLANATION");
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log(result.explanation);

  // Show LLM usage if applicable
  if (result.llmUsage) {
    console.log("\n───────────────────────────────────────────────────────────");
    console.log("LLM USAGE");
    console.log("───────────────────────────────────────────────────────────");
    console.log(`Prompt tokens:     ${result.llmUsage.promptTokens}`);
    console.log(`Completion tokens: ${result.llmUsage.completionTokens}`);
    console.log(`Total tokens:      ${result.llmUsage.totalTokens}`);
  }

  console.log("\n✅ Pipeline completed successfully!");
}

main().catch(console.error);

