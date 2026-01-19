/**
 * Comprehensive validation tests for ALL intake-v2 form steps
 * Run with: npx tsx scripts/test-all-intake-steps.ts
 *
 * Tests validation schemas for all 5 steps to ensure:
 * 1. Required fields are enforced
 * 2. Invalid data is rejected with proper error messages
 * 3. Valid data passes validation
 * 4. Edge cases are handled properly
 */

import { z } from "zod"

// =====================
// ZOD SCHEMAS (from form-config.ts)
// =====================

const step1Schema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional().refine(
    (val) => !val || /^[\d\s\-+().]{7,20}$/.test(val),
    "Please enter a valid phone number"
  ),
  linkedin_url: z.string().optional().refine(
    (val) => !val || /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w\-]+\/?$|^[\w\-]+$/.test(val),
    "Please enter a valid LinkedIn URL"
  ),
})

const step2Schema = z.object({
  q1_employment_status: z.string().min(1, "Please select your employment status"),
  q2_years_experience: z.string().min(1, "Please select your experience level"),
  q3_industry_sectors: z.array(z.string()).min(1, "Please select at least one industry"),
  q5_team_size: z.string().min(1, "Please select a team size"),
  q8_executive_roles: z.array(z.string()).min(1, "Please select at least one role"),
})

const step3Schema = z.object({
  q4_has_ma_experience: z.boolean({ required_error: "Please select Yes or No" }),
  q6_involved_in_ma: z.boolean({ required_error: "Please select Yes or No" }),
  q7_ma_details: z.string().nullable().optional(),
  q9_board_experience: z.boolean({ required_error: "Please select Yes or No" }),
})

const step4Schema = z.object({
  q10_journey_stages: z.array(z.string()).min(1, "Please select at least one stage"),
  q11_target_sectors: z.array(z.string()).min(1, "Please select at least one sector"),
  target_location: z.string().nullable().optional(),
  target_acquisition_size: z.string().nullable().optional(),
  q12_has_identified_targets: z.boolean().nullable().optional(),
  q13_target_details: z.string().nullable().optional(),
})

const step5Schema = z.object({
  q14_investment_capacity: z.string().min(1, "Please select your investment capacity"),
  q15_funding_status: z.string().min(1, "Please select your funding status"),
  q16_network_training: z.array(z.string()).optional(),
  q17_open_to_co_acquisition: z.boolean({ required_error: "Please select Yes or No" }),
  source: z.string().nullable().optional(),
  marketing_consent: z.boolean({ required_error: "Please confirm your consent" }).refine(
    (val) => val === true,
    "You must agree to receive communications to continue"
  ),
})

// =====================
// TEST UTILITIES
// =====================

type TestResult = { pass: boolean; desc: string; field?: string; error?: string }

function runTest(
  schema: z.ZodSchema,
  data: Record<string, unknown>,
  expectedResult: "pass" | "fail",
  desc: string,
  expectedField?: string
): TestResult {
  const result = schema.safeParse(data)
  const actual = result.success ? "pass" : "fail"

  if (actual === expectedResult) {
    return { pass: true, desc }
  }

  // Failed - provide details
  let error: string | undefined
  if (!result.success) {
    const fieldError = result.error.errors.find(e =>
      expectedField ? e.path.join(".") === expectedField : true
    )
    error = fieldError?.message
  }

  return {
    pass: false,
    desc,
    field: expectedField,
    error: actual === "fail" ? error : "Expected to fail but passed"
  }
}

// =====================
// STEP 1: CONTACT INFO TESTS
// =====================

const step1Tests: TestResult[] = []
const step1ValidBase = {
  first_name: "Jean",
  last_name: "Dupont",
  email: "jean@example.com",
  phone: "",
  linkedin_url: "",
}

console.log("\n" + "=".repeat(70))
console.log("INTAKE-V2 COMPREHENSIVE VALIDATION TESTS")
console.log("=".repeat(70))

console.log("\n📋 STEP 1: Contact Information\n")

// Required fields
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, first_name: "" }, "fail", "Empty first name fails", "first_name"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, last_name: "" }, "fail", "Empty last name fails", "last_name"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, email: "" }, "fail", "Empty email fails", "email"))

// Email validation
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, email: "invalid" }, "fail", "Invalid email (no @) fails", "email"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, email: "test@" }, "fail", "Invalid email (no domain) fails", "email"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, email: "@example.com" }, "fail", "Invalid email (no local part) fails", "email"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, email: "test @example.com" }, "fail", "Email with space fails", "email"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, email: "test.name+tag@sub.domain.com" }, "pass", "Complex valid email passes"))

// Phone validation
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, phone: "abc123def" }, "fail", "Phone with letters fails", "phone"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, phone: "123" }, "fail", "Phone too short fails", "phone"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, phone: "123-456-@@@@" }, "fail", "Phone with special chars fails", "phone"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, phone: "+33 6 12 34 56 78" }, "pass", "French phone format passes"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, phone: "(555) 123-4567" }, "pass", "US phone format passes"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, phone: "" }, "pass", "Empty phone (optional) passes"))

// LinkedIn validation
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, linkedin_url: "https://google.com/profile" }, "fail", "Non-LinkedIn URL fails", "linkedin_url"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, linkedin_url: "not a url at all" }, "fail", "Random text fails", "linkedin_url"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, linkedin_url: "linkedin.com/in/johndoe" }, "pass", "LinkedIn without protocol passes"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, linkedin_url: "https://www.linkedin.com/in/john-doe-123" }, "pass", "Full LinkedIn URL passes"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, linkedin_url: "johndoe" }, "pass", "Just username passes"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, linkedin_url: "" }, "pass", "Empty LinkedIn (optional) passes"))

// Edge cases
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, first_name: "Jean-Pierre" }, "pass", "Hyphenated name passes"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, first_name: "José María" }, "pass", "Accented characters pass"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, first_name: "O'Connor" }, "pass", "Apostrophe in name passes"))
step1Tests.push(runTest(step1Schema, { ...step1ValidBase, last_name: "<script>alert('xss')</script>" }, "pass", "XSS attempt stored (sanitize on display)"))

// =====================
// STEP 2: BACKGROUND TESTS
// =====================

const step2Tests: TestResult[] = []
const step2ValidBase = {
  q1_employment_status: "employed",
  q2_years_experience: "10-15",
  q3_industry_sectors: ["tech", "finance"],
  q5_team_size: "10-50",
  q8_executive_roles: ["ceo", "cfo"],
}

console.log("\n📋 STEP 2: Professional Background\n")

// Required fields
step2Tests.push(runTest(step2Schema, { ...step2ValidBase, q1_employment_status: "" }, "fail", "Empty employment status fails", "q1_employment_status"))
step2Tests.push(runTest(step2Schema, { ...step2ValidBase, q2_years_experience: "" }, "fail", "Empty years experience fails", "q2_years_experience"))
step2Tests.push(runTest(step2Schema, { ...step2ValidBase, q3_industry_sectors: [] }, "fail", "Empty industry sectors fails", "q3_industry_sectors"))
step2Tests.push(runTest(step2Schema, { ...step2ValidBase, q5_team_size: "" }, "fail", "Empty team size fails", "q5_team_size"))
step2Tests.push(runTest(step2Schema, { ...step2ValidBase, q8_executive_roles: [] }, "fail", "Empty executive roles fails", "q8_executive_roles"))

// Valid data
step2Tests.push(runTest(step2Schema, step2ValidBase, "pass", "All required fields filled passes"))
step2Tests.push(runTest(step2Schema, { ...step2ValidBase, q3_industry_sectors: ["tech"] }, "pass", "Single industry sector passes"))
step2Tests.push(runTest(step2Schema, { ...step2ValidBase, q8_executive_roles: ["other"] }, "pass", "Single executive role passes"))

// =====================
// STEP 3: M&A EXPERIENCE TESTS
// =====================

const step3Tests: TestResult[] = []
const step3ValidBase = {
  q4_has_ma_experience: true,
  q6_involved_in_ma: false,
  q7_ma_details: null,
  q9_board_experience: true,
}

console.log("\n📋 STEP 3: M&A Experience\n")

// Required fields - boolean fields must be explicitly true or false
step3Tests.push(runTest(step3Schema, { ...step3ValidBase, q4_has_ma_experience: undefined }, "fail", "Undefined M&A experience fails", "q4_has_ma_experience"))
step3Tests.push(runTest(step3Schema, { ...step3ValidBase, q6_involved_in_ma: undefined }, "fail", "Undefined involved in M&A fails", "q6_involved_in_ma"))
step3Tests.push(runTest(step3Schema, { ...step3ValidBase, q9_board_experience: undefined }, "fail", "Undefined board experience fails", "q9_board_experience"))

// Valid data
step3Tests.push(runTest(step3Schema, step3ValidBase, "pass", "All required booleans set passes"))
step3Tests.push(runTest(step3Schema, { ...step3ValidBase, q4_has_ma_experience: false }, "pass", "False M&A experience passes"))
step3Tests.push(runTest(step3Schema, { ...step3ValidBase, q7_ma_details: "I led 3 acquisitions" }, "pass", "M&A details filled passes"))
step3Tests.push(runTest(step3Schema, { ...step3ValidBase, q7_ma_details: null }, "pass", "Null M&A details passes"))
step3Tests.push(runTest(step3Schema, { ...step3ValidBase, q7_ma_details: "" }, "pass", "Empty M&A details passes"))

// =====================
// STEP 4: ACQUISITION GOALS TESTS
// =====================

const step4Tests: TestResult[] = []
const step4ValidBase = {
  q10_journey_stages: ["exploring"],
  q11_target_sectors: ["tech", "healthcare"],
  target_location: null,
  target_acquisition_size: null,
  q12_has_identified_targets: null,
  q13_target_details: null,
}

console.log("\n📋 STEP 4: Acquisition Goals\n")

// Required fields
step4Tests.push(runTest(step4Schema, { ...step4ValidBase, q10_journey_stages: [] }, "fail", "Empty journey stages fails", "q10_journey_stages"))
step4Tests.push(runTest(step4Schema, { ...step4ValidBase, q11_target_sectors: [] }, "fail", "Empty target sectors fails", "q11_target_sectors"))

// Valid data
step4Tests.push(runTest(step4Schema, step4ValidBase, "pass", "Required arrays filled passes"))
step4Tests.push(runTest(step4Schema, { ...step4ValidBase, target_location: "france" }, "pass", "Target location filled passes"))
step4Tests.push(runTest(step4Schema, { ...step4ValidBase, target_acquisition_size: "1m-5m" }, "pass", "Target size filled passes"))
step4Tests.push(runTest(step4Schema, { ...step4ValidBase, q12_has_identified_targets: true }, "pass", "Has identified targets true passes"))
step4Tests.push(runTest(step4Schema, { ...step4ValidBase, q13_target_details: "Target company details" }, "pass", "Target details filled passes"))

// =====================
// STEP 5: FINANCIAL TESTS
// =====================

const step5Tests: TestResult[] = []
const step5ValidBase = {
  q14_investment_capacity: "100k-500k",
  q15_funding_status: "ready",
  q16_network_training: [],
  q17_open_to_co_acquisition: true,
  source: null,
  marketing_consent: true,
}

console.log("\n📋 STEP 5: Financial & Final Details\n")

// Required fields
step5Tests.push(runTest(step5Schema, { ...step5ValidBase, q14_investment_capacity: "" }, "fail", "Empty investment capacity fails", "q14_investment_capacity"))
step5Tests.push(runTest(step5Schema, { ...step5ValidBase, q15_funding_status: "" }, "fail", "Empty funding status fails", "q15_funding_status"))
step5Tests.push(runTest(step5Schema, { ...step5ValidBase, q17_open_to_co_acquisition: undefined }, "fail", "Undefined co-acquisition fails", "q17_open_to_co_acquisition"))
step5Tests.push(runTest(step5Schema, { ...step5ValidBase, marketing_consent: undefined }, "fail", "Undefined marketing consent fails", "marketing_consent"))
step5Tests.push(runTest(step5Schema, { ...step5ValidBase, marketing_consent: false }, "fail", "False marketing consent fails", "marketing_consent"))

// Valid data
step5Tests.push(runTest(step5Schema, step5ValidBase, "pass", "All required fields filled passes"))
step5Tests.push(runTest(step5Schema, { ...step5ValidBase, q16_network_training: ["bpifrance"] }, "pass", "Network training filled passes"))
step5Tests.push(runTest(step5Schema, { ...step5ValidBase, source: "linkedin" }, "pass", "Source filled passes"))

// =====================
// PRINT RESULTS
// =====================

function printResults(stepName: string, tests: TestResult[]) {
  const passed = tests.filter(t => t.pass).length
  const failed = tests.filter(t => !t.pass).length

  for (const test of tests) {
    const icon = test.pass ? "✅" : "❌"
    console.log(`${icon} ${test.desc}`)
    if (!test.pass && test.error) {
      console.log(`   └─ Error: ${test.error}`)
    }
  }

  return { passed, failed }
}

const results1 = printResults("Step 1", step1Tests)
const results2 = printResults("Step 2", step2Tests)
const results3 = printResults("Step 3", step3Tests)
const results4 = printResults("Step 4", step4Tests)
const results5 = printResults("Step 5", step5Tests)

// =====================
// SUMMARY
// =====================

const totalPassed = results1.passed + results2.passed + results3.passed + results4.passed + results5.passed
const totalFailed = results1.failed + results2.failed + results3.failed + results4.failed + results5.failed
const total = totalPassed + totalFailed

console.log("\n" + "=".repeat(70))
console.log("SUMMARY")
console.log("=".repeat(70))
console.log(`\nStep 1 (Contact): ${results1.passed}/${results1.passed + results1.failed} passed`)
console.log(`Step 2 (Background): ${results2.passed}/${results2.passed + results2.failed} passed`)
console.log(`Step 3 (M&A Experience): ${results3.passed}/${results3.passed + results3.failed} passed`)
console.log(`Step 4 (Goals): ${results4.passed}/${results4.passed + results4.failed} passed`)
console.log(`Step 5 (Financial): ${results5.passed}/${results5.passed + results5.failed} passed`)
console.log(`\n📊 TOTAL: ${totalPassed}/${total} tests passed`)

if (totalFailed > 0) {
  console.log(`\n⚠️  ${totalFailed} test(s) failed! Review the validation logic.`)
  process.exit(1)
} else {
  console.log("\n✅ All validation tests passed!")
  process.exit(0)
}
