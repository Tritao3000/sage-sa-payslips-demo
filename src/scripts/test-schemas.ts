import { PayslipResponseSchema } from "../schemas";
import payslipData from "../../payslip-example.json";

const result = PayslipResponseSchema.safeParse(payslipData);

if (result.success) {
  console.log("✅ Schema validation passed!");
  console.log(`   Employee: ${result.data.employeeInfo.companyName}`);
  console.log(`   Payslips: ${result.data.payslipCount}`);
} else {
  console.log("❌ Schema validation failed:");
  console.log(result.error.issues);
}

