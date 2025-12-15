import { test, expect, describe } from "bun:test";
import { PayslipResponseSchema } from "../schemas";
import { getPayslipPairForComparison } from "../utils";
import { comparePayslips } from "./diff-engine";
import {
  generateFacts,
  getKeyFacts,
  getFactsByType,
  getCausalFacts,
  getAllSentences,
} from "./facts-generator";
import payslipData from "../../payslip-example.json";

const data = PayslipResponseSchema.parse(payslipData);
const pair = getPayslipPairForComparison(data.payslipHeaders)!;
const [prev, curr] = pair;
const comparison = comparePayslips(prev, curr);

describe("generateFacts", () => {
  const result = generateFacts(comparison);

  test("returns period description", () => {
    expect(result.periodDescription).toContain("May");
    expect(result.periodDescription).toContain("June");
    expect(result.periodDescription).toContain("2012");
  });

  test("returns employee name", () => {
    expect(result.employeeName).toBe("Mr NEG StandardHost");
  });

  test("generates facts from changes", () => {
    expect(result.facts.length).toBeGreaterThan(0);
  });

  test("facts are sorted by importance", () => {
    const importanceOrder = { high: 0, medium: 1, low: 2 };

    for (let i = 1; i < result.facts.length; i++) {
      const prevFact = result.facts[i - 1];
      const currFact = result.facts[i];
      expect(importanceOrder[currFact!.importance]).toBeGreaterThanOrEqual(
        importanceOrder[prevFact!.importance]
      );
    }
  });

  test("key takeaway mentions net pay", () => {
    expect(result.keyTakeaway.toLowerCase()).toContain("net pay");
  });
});

describe("getKeyFacts", () => {
  const result = generateFacts(comparison);

  test("returns limited number of facts", () => {
    const keyFacts = getKeyFacts(result, 3);
    expect(keyFacts.length).toBeLessThanOrEqual(3);
  });

  test("returns most important facts first", () => {
    const keyFacts = getKeyFacts(result, 5);
    // First fact should be high importance
    expect(keyFacts[0]!.importance).toBe("high");
  });
});

describe("getFactsByType", () => {
  const result = generateFacts(comparison);

  test("filters by net_pay_change", () => {
    const netPayFacts = getFactsByType(result, "net_pay_change");
    netPayFacts.forEach((f) => {
      expect(f.type).toBe("net_pay_change");
    });
  });

  test("filters by deduction_added", () => {
    const addedFacts = getFactsByType(result, "deduction_added");
    addedFacts.forEach((f) => {
      expect(f.type).toBe("deduction_added");
    });
  });
});

describe("getCausalFacts", () => {
  const result = generateFacts(comparison);
  const causalFacts = getCausalFacts(result);

  test("returns only causal facts", () => {
    causalFacts.forEach((f) => {
      expect(f.type).toBe("causal");
    });
  });

  test("causal facts have related change IDs", () => {
    causalFacts.forEach((f) => {
      expect(f.relatedChangeIds).toBeDefined();
      expect(f.relatedChangeIds!.length).toBeGreaterThan(0);
    });
  });
});

describe("getAllSentences", () => {
  const result = generateFacts(comparison);
  const sentences = getAllSentences(result);

  test("returns array of strings", () => {
    expect(Array.isArray(sentences)).toBe(true);
    sentences.forEach((s) => {
      expect(typeof s).toBe("string");
    });
  });

  test("sentences are non-empty", () => {
    sentences.forEach((s) => {
      expect(s.length).toBeGreaterThan(0);
    });
  });
});

describe("sentence quality", () => {
  const result = generateFacts(comparison);

  test("net pay sentence includes currency", () => {
    const netPayFact = result.facts.find((f) => f.type === "net_pay_change");
    expect(netPayFact?.sentence).toContain("ZAR");
  });

  test("added deduction sentence is descriptive", () => {
    const addedFacts = getFactsByType(result, "deduction_added");
    if (addedFacts.length > 0) {
      expect(addedFacts[0]!.sentence).toContain("deduction");
    }
  });
});

// Print all facts for visual inspection
test("print all generated facts", () => {
  const result = generateFacts(comparison);

  console.log("\n════════════════════════════════════════════════════════");
  console.log("GENERATED FACTS");
  console.log("════════════════════════════════════════════════════════");
  console.log(`📅 ${result.periodDescription}`);
  console.log(`👤 ${result.employeeName}`);
  console.log(`\n🎯 Key Takeaway: ${result.keyTakeaway}`);
  console.log("\n────────────────────────────────────────────────────────");
  console.log("All Facts:");
  console.log("────────────────────────────────────────────────────────\n");

  result.facts.forEach((fact, i) => {
    const icon =
      fact.importance === "high" ? "🔴" : fact.importance === "medium" ? "🟡" : "🟢";
    console.log(`${i + 1}. ${icon} [${fact.type}] ${fact.sentence}`);
  });

  console.log("\n────────────────────────────────────────────────────────");
  console.log("Causal Explanations:");
  console.log("────────────────────────────────────────────────────────\n");

  const causal = getCausalFacts(result);
  causal.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.sentence}`);
  });

  expect(true).toBe(true);
});

