/**
 * Payslip Comparison API Server
 *
 * Endpoints:
 *   GET  /api/periods          - List available periods
 *   GET  /api/compare/:month/:year - Compare month with previous
 *   GET  /                     - Frontend UI
 *
 * Usage:
 *   bun src/server.ts
 *
 * Environment:
 *   OPENAI_API_KEY - Required for LLM narration
 */

import { PayslipResponseSchema, type PayslipHeader } from "./schemas";
import {
  filterPrimaryPayslips,
  sortPayslipsByPeriod,
  normalizePayslip,
  getPrimaryPayslipForPeriod,
} from "./utils";
import { comparePayslips, generateFacts, narrateFacts, narrateFactsSimple } from "./engine";
import payslipData from "../payslip-example.json";
import index from "./index.html";

// ─────────────────────────────────────────────────────────────
// Load Data
// ─────────────────────────────────────────────────────────────

const data = PayslipResponseSchema.parse(payslipData);
const primaryPayslips = sortPayslipsByPeriod(filterPrimaryPayslips(data.payslipHeaders));

// Check for API key
const hasApiKey = !!process.env.OPENAI_API_KEY;
if (!hasApiKey) {
  console.warn("⚠️  OPENAI_API_KEY not set - LLM narration disabled");
}

// ─────────────────────────────────────────────────────────────
// API Handlers
// ─────────────────────────────────────────────────────────────

interface PeriodInfo {
  year: number;
  month: number;
  monthName: string;
  netPay: number;
  payslipID: number;
  hasPrevious: boolean;
}

function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return months[month - 1] || `Month ${month}`;
}

function getAvailablePeriods(): PeriodInfo[] {
  return primaryPayslips.map((ps, idx) => ({
    year: ps.calendarYear,
    month: ps.calendarMonth,
    monthName: getMonthName(ps.calendarMonth),
    netPay: ps.netPay,
    payslipID: ps.payslipID,
    hasPrevious: idx > 0,
  }));
}

function findPayslipIndex(year: number, month: number): number {
  return primaryPayslips.findIndex(
    (ps) => ps.calendarYear === year && ps.calendarMonth === month
  );
}

async function compareMonthWithPrevious(year: number, month: number, useLLM: boolean) {
  const currentIdx = findPayslipIndex(year, month);

  if (currentIdx === -1) {
    return { error: `No payslip found for ${month}/${year}` };
  }

  if (currentIdx === 0) {
    return { error: `No previous payslip to compare with for ${month}/${year}` };
  }

  const current = primaryPayslips[currentIdx]!;
  const previous = primaryPayslips[currentIdx - 1]!;

  const currNormalized = normalizePayslip(current);
  const prevNormalized = normalizePayslip(previous);

  const comparison = comparePayslips(prevNormalized, currNormalized);
  const facts = generateFacts(comparison);

  let explanation: string;
  let llmUsed = false;

  if (useLLM && hasApiKey) {
    try {
      const result = await narrateFacts(facts, { model: "gpt-4o-mini" });
      explanation = result.explanation;
      llmUsed = true;
    } catch (err) {
      console.error("LLM error:", err);
      explanation = narrateFactsSimple(facts);
    }
  } else {
    explanation = narrateFactsSimple(facts);
  }

  return {
    success: true,
    llmUsed,
    periods: {
      previous: {
        year: previous.calendarYear,
        month: previous.calendarMonth,
        monthName: getMonthName(previous.calendarMonth),
        netPay: previous.netPay,
      },
      current: {
        year: current.calendarYear,
        month: current.calendarMonth,
        monthName: getMonthName(current.calendarMonth),
        netPay: current.netPay,
      },
    },
    summary: comparison.summary,
    facts: facts.facts.map((f) => ({
      type: f.type,
      importance: f.importance,
      sentence: f.sentence,
    })),
    explanation,
  };
}

// ─────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

Bun.serve({
  port: PORT,
  routes: {
    "/": index,

    "/api/periods": {
      GET: () => {
        return Response.json({
          employeeName: data.employeeInfo.companyName,
          periods: getAvailablePeriods(),
          llmAvailable: hasApiKey,
        });
      },
    },

    "/api/compare/:month/:year": {
      GET: async (req) => {
        const month = parseInt(req.params.month, 10);
        const year = parseInt(req.params.year, 10);
        const useLLM = req.url.includes("llm=true");

        if (isNaN(month) || isNaN(year)) {
          return Response.json({ error: "Invalid month or year" }, { status: 400 });
        }

        const result = await compareMonthWithPrevious(year, month, useLLM);

        if ("error" in result) {
          return Response.json(result, { status: 404 });
        }

        return Response.json(result);
      },
    },
  },

  fetch(req) {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`
═══════════════════════════════════════════════════════════
  🚀 Payslip Comparison Server
═══════════════════════════════════════════════════════════

  URL:     http://localhost:${PORT}
  LLM:     ${hasApiKey ? "✅ Enabled" : "❌ Disabled (set OPENAI_API_KEY)"}

  Endpoints:
    GET /                        → Frontend UI
    GET /api/periods             → List available periods
    GET /api/compare/:month/:year → Compare with previous
        ?llm=true                → Use LLM narration

═══════════════════════════════════════════════════════════
`);

