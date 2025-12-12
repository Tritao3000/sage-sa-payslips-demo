import { PayslipResponseSchema, type PayslipHeader } from "../schemas";
import payslipData from "../../payslip-example.json";

const data = PayslipResponseSchema.parse(payslipData);

// Group by period
const byPeriod = new Map<string, PayslipHeader[]>();

for (const ps of data.payslipHeaders) {
  const key = `${ps.calendarYear}-${String(ps.calendarMonth).padStart(2, "0")}`;
  if (!byPeriod.has(key)) byPeriod.set(key, []);
  byPeriod.get(key)!.push(ps);
}

console.log("═══════════════════════════════════════════════════════════");
console.log("ANALYZING PAIRED PAYSLIPS PER PERIOD");
console.log("═══════════════════════════════════════════════════════════\n");

for (const [period, payslips] of byPeriod) {
  console.log(`\n📅 PERIOD: ${period} (${payslips.length} payslips)`);
  console.log("─".repeat(60));

  for (const ps of payslips) {
    const salary = ps.earnings.find((e) => e.lineCode === "SALARY")?.total ?? 0;
    const travel = ps.earnings.find((e) => e.lineCode === "TRAVEL")?.total ?? 0;
    const ot15 = ps.earnings.find((e) => e.lineCode === "OTIME1_5")?.total ?? 0;
    const ot20 = ps.earnings.find((e) => e.lineCode === "OTIME2_0")?.total ?? 0;
    const comm = ps.earnings.find((e) => e.lineCode === "COMM")?.total ?? 0;
    const paye = ps.deductions.find((d) => d.lineCode === "PAYE")?.total ?? 0;
    const uif = ps.deductions.find((d) => d.lineCode === "UIF")?.total ?? 0;
    const mstdhost = ps.deductions.find((d) => d.lineCode === "MSTANDARDHOST")?.total ?? 0;

    const totalEarnings = ps.earnings.reduce((sum, e) => sum + e.total, 0);
    const totalDeductions = ps.deductions.reduce((sum, d) => sum + d.total, 0);

    console.log(`\n  Payslip ID: ${ps.payslipID}`);
    console.log(`  ├─ SALARY:     ${salary.toFixed(2).padStart(10)}`);
    console.log(`  ├─ TRAVEL:     ${travel.toFixed(2).padStart(10)}`);
    console.log(`  ├─ OTIME1.5:   ${ot15.toFixed(2).padStart(10)}`);
    console.log(`  ├─ OTIME2.0:   ${ot20.toFixed(2).padStart(10)}`);
    console.log(`  ├─ COMMISSION: ${comm.toFixed(2).padStart(10)}`);
    console.log(`  ├─ ─────────────────────`);
    console.log(`  ├─ Total Earn: ${totalEarnings.toFixed(2).padStart(10)}`);
    console.log(`  ├─ PAYE:       ${paye.toFixed(2).padStart(10)}`);
    console.log(`  ├─ UIF:        ${uif.toFixed(2).padStart(10)}`);
    console.log(`  ├─ MSTDHOST:   ${mstdhost.toFixed(2).padStart(10)}`);
    console.log(`  ├─ Total Ded:  ${totalDeductions.toFixed(2).padStart(10)}`);
    console.log(`  └─ NET PAY:    ${ps.netPay.toFixed(2).padStart(10)}`);
  }

  // Summary comparison
  if (payslips.length === 2) {
    const [a, b] = payslips;
    const aSalary = a?.earnings.find((e) => e.lineCode === "SALARY")?.total ?? 0;
    const bSalary = b?.earnings.find((e) => e.lineCode === "SALARY")?.total ?? 0;

    console.log(`\n  📊 PATTERN:`);
    if (aSalary > 0 && bSalary === 0) {
      console.log(`     → ID ${a?.payslipID}: MAIN RUN (has salary)`);
      console.log(`     → ID ${b?.payslipID}: SUPPLEMENTARY (no salary, variable pay only)`);
    } else if (bSalary > 0 && aSalary === 0) {
      console.log(`     → ID ${b?.payslipID}: MAIN RUN (has salary)`);
      console.log(`     → ID ${a?.payslipID}: SUPPLEMENTARY (no salary, variable pay only)`);
    } else {
      console.log(`     → Both have salary=${aSalary}/${bSalary} - different pattern`);
    }
  }
}

