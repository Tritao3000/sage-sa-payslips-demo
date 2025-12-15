import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { FactsResult } from "../schemas/fact";
import { getAllSentences, getKeyFacts } from "./facts-generator";

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

export interface NarratorConfig {
  /** OpenAI model to use */
  model?: string;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Temperature (0 = deterministic, 1 = creative) */
  temperature?: number;
  /** Language for the explanation */
  language?: "en" | "af";
}

const DEFAULT_CONFIG: Required<NarratorConfig> = {
  model: "gpt-4o-mini",
  maxTokens: 1024,
  temperature: 0.3,
  language: "en",
};

// ─────────────────────────────────────────────────────────────
// Prompt Template
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(language: "en" | "af"): string {
  if (language === "af") {
    return `Jy is 'n vriendelike HR-assistent wat betaalstrokies aan werknemers verduidelik.

STRENG REËLS:
- Moet NOOIT enige getalle bereken of aflei nie
- Moet NOOIT oorsake of redes byvoeg wat nie eksplisiet genoem word nie
- Gebruik SLEGS die feite wat verskaf word
- Hou die verduideliking kort en duidelik
- Wees vriendelik en professioneel
- Gebruik ZAR vir geldbedrae

Jou taak is om die gegewe feite in 'n natuurlike, leesbare paragraaf te herskryf.`;
  }

  return `You are a friendly HR assistant explaining payslips to employees.

STRICT RULES:
- NEVER calculate or infer any numbers yourself
- NEVER add causes or reasons not explicitly stated in the facts
- Use ONLY the facts provided to you
- Keep the explanation concise and clear
- Be friendly and professional
- Use ZAR for currency amounts
- Address the employee directly using "you/your"

Your task is to rewrite the given facts into a natural, readable explanation.
Group related changes together and present them in a logical order.
Start with the most important change (net pay), then explain what contributed to it.`;
}

function buildUserPrompt(facts: FactsResult): string {
  const sentences = getAllSentences(facts);
  const keyFacts = getKeyFacts(facts, 3);

  return `Employee: ${facts.employeeName}
Period: ${facts.periodDescription}

KEY CHANGES (most important):
${keyFacts.map((f) => `- ${f.sentence}`).join("\n")}

ALL FACTS TO INCLUDE:
${sentences.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Please write a clear, friendly explanation of these payslip changes for the employee.
Keep it to 2-3 short paragraphs maximum. Do not add any information not in the facts above.`;
}

// ─────────────────────────────────────────────────────────────
// Main Narrator Function
// ─────────────────────────────────────────────────────────────

export interface NarratorResult {
  /** The generated explanation */
  explanation: string;
  /** Token usage */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Model used */
  model: string;
}

/**
 * Generate a natural language explanation from facts using an LLM
 */
export async function narrateFacts(
  facts: FactsResult,
  config: NarratorConfig = {}
): Promise<NarratorResult> {
  const { model, maxTokens, temperature, language } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const systemPrompt = buildSystemPrompt(language);
  const userPrompt = buildUserPrompt(facts);

  const result = await generateText({
    model: openai(model),
    system: systemPrompt,
    prompt: userPrompt,

    temperature,
  });

  return {
    explanation: result.text.trim(),
    model,
  };
}

// ─────────────────────────────────────────────────────────────
// Fallback (No LLM) - for testing or when API unavailable
// ─────────────────────────────────────────────────────────────

/**
 * Generate a simple explanation without using an LLM
 * Uses the pre-generated sentences directly
 */
export function narrateFactsSimple(facts: FactsResult): string {
  const keyFacts = getKeyFacts(facts, 5);

  const lines = [
    `📋 **Payslip Summary for ${facts.employeeName}**`,
    `📅 ${facts.periodDescription}`,
    "",
    `**Key Takeaway:** ${facts.keyTakeaway}`,
    "",
    "**Details:**",
    ...keyFacts.map((f) => `• ${f.sentence}`),
  ];

  return lines.join("\n");
}

