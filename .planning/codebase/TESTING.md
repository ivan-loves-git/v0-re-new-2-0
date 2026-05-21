# Testing Patterns

**Analysis Date:** 2026-05-21

## Test Framework

**Runner:**
- Vitest `^3.0.0`
- Config: `vitest.config.ts`
- Unit test environment: `node` in `vitest.config.ts`
- Included tests: `lib/**/__tests__/**/*.test.ts` and `lib/**/*.test.ts` in `vitest.config.ts`
- Excluded tests: `scripts/e2e-tests/**`, `_archive/**`, `.next/**`, and `node_modules/**` in `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect`, imported from `vitest`.
- Custom browser-test assertion helpers exist in `scripts/e2e-tests/utils/assertions.ts`, but they are outside the Vitest run.

**Run Commands:**
```bash
npm run test           # Run all Vitest unit tests
npm run test:watch     # Run Vitest in watch mode
npm run test:coverage  # Run Vitest with v8 coverage
npm run lint           # Run ESLint across non-ignored app code
npm run build          # Run Next.js production build
```

## Test File Organization

**Location:**
- Unit tests are co-located under `lib/**/__tests__/`: `lib/utils/__tests__/scoring-v2.test.ts`, `lib/utils/__tests__/intake-integration.test.ts`.
- Current Vitest coverage is concentrated on pure utility/domain logic in `lib/utils/`.
- Browser-oriented E2E specifications live separately under `scripts/e2e-tests/tests/` and are intentionally excluded from Vitest, TypeScript project includes, and ESLint.
- A phase-specific smoke spec exists under `.planning/phases/06-ma-source-directory-and-intermediary-email-workflows/ma-smoke.spec.ts`; it is planning artifact coverage, not part of the configured Vitest suite.

**Naming:**
- Use `*.test.ts` for Vitest unit tests: `lib/utils/__tests__/opportunity-match-scoring.test.ts`.
- E2E script files also use `*.test.ts`, but they export `TestSuite` objects instead of Vitest suites: `scripts/e2e-tests/tests/auth.test.ts`.

**Structure:**
```text
lib/
└── utils/
    ├── scoring-v2.ts
    ├── opportunity-match-scoring.ts
    └── __tests__/
        ├── scoring-v2.test.ts
        ├── intake-integration.test.ts
        ├── opportunity-journey.test.ts
        └── opportunity-match-scoring.test.ts

scripts/
└── e2e-tests/
    ├── index.ts
    ├── config.ts
    ├── types.ts
    ├── tests/
    │   ├── auth.test.ts
    │   ├── dashboard.test.ts
    │   ├── repreneurs.test.ts
    │   └── ...
    └── utils/
        ├── assertions.ts
        ├── report.ts
        ├── supabase.ts
        └── test-data.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from "vitest"
import { calculateOpportunityMatchScore } from "../opportunity-match-scoring"

describe("calculateOpportunityMatchScore", () => {
  it("returns a strong fit when readiness, sector, geography, and deal size align", () => {
    const result = calculateOpportunityMatchScore(
      {
        who_score: 90,
        when_score: 92,
        q13_target_sectors_v2: ["industry"],
        q12_geo_zones: ["ile-de-france"],
        q14_deal_size: ["1-3M"],
      },
      {
        sector: "industry",
        activity: "precision workshop",
        location: "ile-de-france",
        revenue_meur: 2,
      },
    )

    expect(result.score).toBe(91)
    expect(result.recommendation).toBe("strong_fit")
    expect(result.reasons).toContain("Sector or activity matches the repreneur target preference.")
  })
})
```

**Patterns:**
- Group tests by domain rule and scenario with nested `describe` blocks: `WHO Score Calculation`, `Triangulation Matrix`, and `WHEN Score Calculation` in `lib/utils/__tests__/scoring-v2.test.ts`.
- Use explicit fixture objects inside the scenario being tested rather than shared global fixtures: `formData` blocks in `lib/utils/__tests__/intake-integration.test.ts`.
- Assert exact numerical outputs for deterministic scoring logic: `expect(result.score).toBe(100)` in `lib/utils/__tests__/scoring-v2.test.ts`.
- Assert both final outcomes and explanatory metadata where functions return structured results: `result.recommendation` and `result.reasons` in `lib/utils/__tests__/opportunity-match-scoring.test.ts`.
- Cover edge and legacy cases explicitly, such as empty selections, multiple structures, and legacy string fields: `lib/utils/__tests__/scoring-v2.test.ts`, `lib/utils/__tests__/opportunity-match-scoring.test.ts`.

## Mocking

**Framework:** Vitest mock APIs are available but not currently used in the configured `lib/**` unit tests.

**Patterns:**
```typescript
// Current preferred pattern for tested utilities: no mocks.
// Pass plain typed objects into pure functions and assert returned values.
const result = calculateDualScore(whoAnswers, whenAnswers)
expect(result.recommendation).toBe("deal_flow")
```

**What to Mock:**
- Mock external services only when adding tests around side-effecting modules such as `lib/email/send-email.ts`, `lib/auth.ts`, or `app/api/wavy/generate/route.ts`.
- Mock Supabase clients when testing server actions in `lib/actions/` to avoid writing production or shared test data.
- Mock `next/cache`, `next/navigation`, and `next/headers` when unit testing server actions or auth helpers that call `revalidatePath`, `redirect`, or `headers`.

**What NOT to Mock:**
- Do not mock pure scoring and transformation utilities in `lib/utils/`; use real data objects as in `lib/utils/__tests__/scoring-v2.test.ts`.
- Do not mock constants or option lists from `lib/types/` when validating business rules; import the real types/constants and assert behavior against current domain vocabulary.
- Do not run browser E2E scripts through Vitest unless the test runner is intentionally migrated; `scripts/e2e-tests/**` has a custom `TestSuite` model.

## Fixtures and Factories

**Test Data:**
```typescript
const formData: IntakeFormData = {
  first_name: "Jean",
  last_name: "Dupont",
  email: "jean.dupont@example.com",
  phone: "+33 6 12 34 56 78",
  cv_url: "https://example.com/cv.pdf",
  linkedin_url: "https://linkedin.com/in/jeandupont",
  q05_current_status: "entrepreneur",
  q06_years_experience_v2: "more_than_20",
  q07_leadership: "general_management",
  q08_crisis_management: "multiple",
  q09_investment_decisions: "both",
  q10_personal_impact: "financial",
  q11_project_status: ["loi"],
  q12_geographic_zones: ["ile-de-france", "hauts-de-france"],
  q13_target_sectors_v2: ["tech", "industry"],
  q14_deal_size: ["3-5M"],
  q15_capital_structure: ["majority_with_minority"],
  q16_equity_contribution: ">450",
  q17_current_needs: ["deal_sourcing", "due_diligence"],
  q18_investment_thesis_url: "https://example.com/thesis.pdf",
  marketing_consent: true,
}
```

**Location:**
- Unit test fixtures are inline in test files: `lib/utils/__tests__/intake-integration.test.ts`, `lib/utils/__tests__/scoring-v2.test.ts`.
- E2E test data helpers live in `scripts/e2e-tests/utils/test-data.ts`.
- E2E data validation helpers live in `scripts/e2e-tests/utils/supabase.ts`.
- E2E config centralizes target URLs, selectors, timeouts, and test-data prefixes in `scripts/e2e-tests/config.ts`.

## Coverage

**Requirements:** No numeric coverage threshold is enforced in `vitest.config.ts`.

**View Coverage:**
```bash
npm run test:coverage
```

**Coverage Scope:**
- Coverage provider: `v8` in `vitest.config.ts`.
- Coverage reporters: `text`, `json`, and `html` in `vitest.config.ts`.
- Coverage include: `lib/**/*.ts`.
- Coverage exclude: `lib/**/__tests__/**` and `lib/types/**`.
- App Router pages, React components, API routes, server actions, and scripts are outside the current coverage include unless they are moved under `lib/**/*.ts` or the config is expanded.

## Test Types

**Unit Tests:**
- Scope: deterministic domain utilities under `lib/utils/`.
- Approach: invoke pure functions directly, with typed objects and exact assertions.
- Examples: `lib/utils/__tests__/scoring-v2.test.ts`, `lib/utils/__tests__/opportunity-match-scoring.test.ts`, `lib/utils/__tests__/opportunity-journey.test.ts`.

**Integration Tests:**
- Scope: in-process transformation and scoring pipelines, not network or database integration.
- Approach: create realistic intake-form shaped data, transform it into scoring inputs, and assert final recommendations/flags/scores.
- Example: `lib/utils/__tests__/intake-integration.test.ts`.

**E2E Tests:**
- Framework: Custom TypeScript test harness for browser automation, not Playwright/Vitest.
- Location: `scripts/e2e-tests/`.
- Runner entry: `scripts/e2e-tests/index.ts`.
- Suite model: `TestSuite`, `TestCase`, `TestContext`, and `TestResult` in `scripts/e2e-tests/types.ts`.
- Suites: `scripts/e2e-tests/tests/auth.test.ts`, `scripts/e2e-tests/tests/dashboard.test.ts`, `scripts/e2e-tests/tests/repreneurs.test.ts`, `scripts/e2e-tests/tests/pipeline.test.ts`, `scripts/e2e-tests/tests/offers.test.ts`, `scripts/e2e-tests/tests/emails.test.ts`, and related files.
- Reports: `scripts/e2e-tests/reports/`.

## Common Patterns

**Async Testing:**
```typescript
// Vitest unit tests currently avoid async by testing pure utilities.
// For async code, keep the same describe/it shape and await the operation.
it("returns generated data", async () => {
  const result = await someAsyncHelper()
  expect(result).toEqual(expected)
})
```

**Error Testing:**
```typescript
// Use this shape when adding unit tests for validation helpers.
expect(() => {
  validateInput(invalidInput)
}).toThrow("Expected validation message")
```

**E2E Test Case Pattern:**
```typescript
export const authTests: TestSuite = {
  name: "Authentication",
  description: "Login, logout, and session management",
  tests: [
    {
      name: "Login page loads correctly",
      description: "Verify the login page renders with email/password fields",
      async run(ctx: TestContext): Promise<TestResult> {
        const start = Date.now()
        try {
          await ctx.navigate(ROUTES.login)
          const emailExists = await ctx.elementExists(SELECTORS.loginEmail)
          return emailExists
            ? pass(this.name, "Login page loaded", Date.now() - start)
            : fail(this.name, "Missing email input", { type: "element_not_found" }, Date.now() - start)
        } catch (error: any) {
          return fail(this.name, error.message, { type: "unknown", stack: error.stack }, Date.now() - start)
        }
      },
    },
  ],
}
```

**Adding New Tests:**
- Add pure business-rule tests under `lib/**/__tests__/*.test.ts` so they run under `npm run test`.
- Add browser journey definitions under `scripts/e2e-tests/tests/` only when the custom E2E harness is the intended execution path.
- Keep E2E selectors centralized in `scripts/e2e-tests/config.ts`.
- Keep test records prefixed with the configured `TEST_E2E_` prefix from `scripts/e2e-tests/config.ts` so cleanup helpers can find them.

---

*Testing analysis: 2026-05-21*
