/**
 * Headless validation tests for intake-v2 form
 * Run with: npx tsx scripts/test-intake-validation.ts
 */

import { z } from "zod"

// Recreate the validation schemas from form-config.ts
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

// Test cases
const tests = {
  // Email validation tests
  email: [
    { input: "", expected: "fail", desc: "Empty email" },
    { input: "testexample.com", expected: "fail", desc: "Missing @" },
    { input: "test@", expected: "fail", desc: "Missing domain" },
    { input: "test @example.com", expected: "fail", desc: "Space in email" },
    { input: "test<>@example.com", expected: "fail", desc: "Special chars" },
    { input: "valid@example.com", expected: "pass", desc: "Valid email" },
    { input: "test.name+tag@sub.domain.com", expected: "pass", desc: "Complex valid email" },
  ],

  // Phone validation tests
  phone: [
    { input: "abc123def", expected: "fail", desc: "Letters in phone" },
    { input: "123", expected: "fail", desc: "Too short" },
    { input: "123-456-@@@@", expected: "fail", desc: "Invalid chars" },
    { input: "12345678901234567890123456789", expected: "fail", desc: "Too long" },
    { input: "+33 6 12 34 56 78", expected: "pass", desc: "Valid French format" },
    { input: "(555) 123-4567", expected: "pass", desc: "Valid US format" },
    { input: "", expected: "pass", desc: "Empty (optional)" },
  ],

  // Required fields tests
  required: [
    { data: { first_name: "", last_name: "Test", email: "test@example.com" }, expected: "fail", desc: "Missing first name" },
    { data: { first_name: "Test", last_name: "", email: "test@example.com" }, expected: "fail", desc: "Missing last name" },
    { data: { first_name: "Test", last_name: "User", email: "" }, expected: "fail", desc: "Missing email" },
    { data: { first_name: "Test", last_name: "User", email: "test@example.com" }, expected: "pass", desc: "All required filled" },
  ],

  // LinkedIn validation tests
  linkedin: [
    { input: "https://google.com/profile", expected: "fail", desc: "Non-LinkedIn URL" },
    { input: "linkedin.com/profile/test", expected: "fail", desc: "Wrong path structure" },
    { input: "linkdin.com/in/test", expected: "fail", desc: "Typo in domain" },
    { input: "not a url at all", expected: "fail", desc: "Random text" },
    { input: "linkedin.com/in/johndoe", expected: "pass", desc: "Valid LinkedIn" },
    { input: "https://www.linkedin.com/in/john-doe-123", expected: "pass", desc: "Full LinkedIn URL" },
    { input: "johndoe", expected: "pass", desc: "Just username" },
    { input: "", expected: "pass", desc: "Empty (optional)" },
  ],

  // Edge cases & security tests
  edge: [
    { field: "first_name", input: "A".repeat(500), expected: "pass", desc: "Very long name (500 chars)" },
    { field: "first_name", input: "<script>alert('xss')</script>", expected: "pass", desc: "XSS attempt" },
    { field: "last_name", input: "'; DROP TABLE users; --", expected: "pass", desc: "SQL injection" },
    { field: "first_name", input: "Jean-Pierre 🎉", expected: "pass", desc: "Unicode/emoji" },
    { field: "last_name", input: "<b>Bold</b>", expected: "pass", desc: "HTML tags" },
    { field: "first_name", input: "O'Connor", expected: "pass", desc: "Apostrophe" },
    { field: "first_name", input: "José María", expected: "pass", desc: "Accented chars" },
  ],
}

// Run tests
console.log("\n🧪 INTAKE-V2 FORM VALIDATION TESTS\n")
console.log("=".repeat(60))

let passed = 0
let failed = 0

// Test emails
console.log("\n📧 EMAIL VALIDATION\n")
for (const test of tests.email) {
  const data = { first_name: "Test", last_name: "User", email: test.input }
  const result = step1Schema.safeParse(data)
  const actual = result.success ? "pass" : "fail"
  const status = actual === test.expected ? "✅" : "❌"
  if (actual === test.expected) passed++; else failed++
  console.log(`${status} ${test.desc}: "${test.input}" → ${actual}`)
  if (!result.success && actual !== test.expected) {
    console.log(`   Error: ${result.error.errors[0]?.message}`)
  }
}

// Test phones
console.log("\n📱 PHONE VALIDATION\n")
for (const test of tests.phone) {
  const data = { first_name: "Test", last_name: "User", email: "test@example.com", phone: test.input }
  const result = step1Schema.safeParse(data)
  const actual = result.success ? "pass" : "fail"
  const status = actual === test.expected ? "✅" : "❌"
  if (actual === test.expected) passed++; else failed++
  console.log(`${status} ${test.desc}: "${test.input}" → ${actual}`)
  if (!result.success && actual !== test.expected) {
    console.log(`   Error: ${result.error.errors[0]?.message}`)
  }
}

// Test required fields
console.log("\n📋 REQUIRED FIELDS VALIDATION\n")
for (const test of tests.required) {
  const result = step1Schema.safeParse(test.data)
  const actual = result.success ? "pass" : "fail"
  const status = actual === test.expected ? "✅" : "❌"
  if (actual === test.expected) passed++; else failed++
  console.log(`${status} ${test.desc} → ${actual}`)
  if (!result.success && actual !== test.expected) {
    console.log(`   Errors: ${result.error.errors.map(e => e.message).join(", ")}`)
  }
}

// Test LinkedIn
console.log("\n💼 LINKEDIN VALIDATION\n")
for (const test of tests.linkedin) {
  const data = { first_name: "Test", last_name: "User", email: "test@example.com", linkedin_url: test.input }
  const result = step1Schema.safeParse(data)
  const actual = result.success ? "pass" : "fail"
  const status = actual === test.expected ? "✅" : "❌"
  if (actual === test.expected) passed++; else failed++
  console.log(`${status} ${test.desc}: "${test.input}" → ${actual}`)
  if (!result.success && actual !== test.expected) {
    console.log(`   Error: ${result.error.errors[0]?.message}`)
  }
}

// Test edge cases
console.log("\n🔒 EDGE CASES & SECURITY\n")
for (const test of tests.edge) {
  const data: any = { first_name: "Test", last_name: "User", email: "test@example.com" }
  data[test.field] = test.input
  const result = step1Schema.safeParse(data)
  const actual = result.success ? "pass" : "fail"
  const status = actual === test.expected ? "✅" : "❌"
  if (actual === test.expected) passed++; else failed++
  const displayInput = test.input.length > 30 ? test.input.slice(0, 30) + "..." : test.input
  console.log(`${status} ${test.desc}: "${displayInput}" → ${actual}`)
}

// Summary
console.log("\n" + "=".repeat(60))
console.log(`\n📊 SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} tests`)

if (failed > 0) {
  console.log("\n⚠️  Some validations may need attention!")
  process.exit(1)
} else {
  console.log("\n✅ All validations working correctly!")
  process.exit(0)
}
