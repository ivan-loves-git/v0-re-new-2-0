# Testing Patterns

**Analysis Date:** 2026-01-26

## Test Framework

**Runner:**
- Vitest 3.0.0
- Config: `vitest.config.ts`
- Environment: Node.js (not browser)

**Assertion Library:**
- Vitest built-in `expect()` from `vitest` package
- Simple assertion API: `expect(value).toBe(expected)`, `expect(array).toContain(item)`, etc.

**Run Commands:**
```bash
npm run test              # Run all tests once
npm run test:watch       # Run tests in watch mode (re-run on changes)
npm run test:coverage    # Generate coverage report (text, JSON, HTML)
```

## Test File Organization

**Location:**
- Co-located in `__tests__/` directory adjacent to source code
- Example: `lib/utils/__tests__/scoring-v2.test.ts` tests `lib/utils/scoring-v2.ts`
- E2E tests in separate directory: `scripts/e2e-tests/tests/`

**Naming:**
- `.test.ts` suffix for unit tests (vitest)
- `.test.ts` suffix for integration tests (vitest)
- E2E tests: `scripts/e2e-tests/tests/*.test.ts`

**Vitest Configuration (vitest.config.ts):**
```typescript
test: {
  environment: 'node',
  include: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  exclude: ['node_modules', '.next', 'scripts/e2e-tests/**'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
    include: ['lib/**/*.ts'],
    exclude: ['lib/**/__tests__/**', 'lib/types/**']
  }
}
```

## Test Structure

**Suite Organization (from `lib/utils/__tests__/scoring-v2.test.ts`):**
```typescript
describe('Feature Area', () => {
  describe('Specific Behavior', () => {
    it('does X under Y conditions', () => {
      // Arrange
      const input = ...

      // Act
      const result = function(input)

      // Assert
      expect(result).toBe(expected)
    })
  })
})
```

**Pattern:**
1. **Describe blocks** organize tests hierarchically: outer for feature, inner for specific behaviors
2. **It blocks** are individual test cases with descriptive names
3. **AAA pattern:** Arrange (setup), Act (call function), Assert (check results)

**Example from scoring tests:**
```typescript
describe('WHO Score Calculation', () => {
  it('calculates maximum score (100)', () => {
    const answers: WhoAnswers = {
      q05: 'entrepreneur',
      q06: 'more_than_20',
      // ... all answers for max score
    }

    const result = calculateWhoScore(answers)

    expect(result.score).toBe(100)
    expect(result.breakdown).toEqual({
      q05: 5,
      q06: 15,
      // ... expected breakdown
    })
  })
})
```

## Patterns in This Codebase

### Unit Test Pattern: Pure Functions

**Testing scoring functions (`lib/utils/__tests__/scoring-v2.test.ts`):**
- No setup/teardown needed (pure functions)
- Test multiple scenarios: minimum, maximum, mid-range, edge cases
- Validate both output AND internal breakdown/structure
- Group related scenarios in nested `describe` blocks

**Example pattern:**
```typescript
describe('WHO Score Calculation', () => {
  it('calculates maximum score (100)', () => {
    // Test max case
  })

  it('calculates minimum score (6)', () => {
    // Test min case
  })

  it('calculates typical mid-range score (59)', () => {
    // Test typical case
  })
})
```

### Integration Test Pattern: Multiple Transformations

**Testing full intake flow (`lib/utils/__tests__/intake-integration.test.ts`):**
- Simulates complete user journey from form submission to scoring results
- Includes form data transformation: form fields → typed scoring inputs → calculated scores
- Tests data consistency across transformation layers
- Validates end-to-end scoring logic with realistic scenarios

**Example scenario from test:**
```typescript
describe('Intake Integration - Full Flow', () => {
  describe('Scenario: Serial Entrepreneur Ready for Deal Flow', () => {
    const formData: IntakeFormData = {
      // Full form data with WHO questions (Q05-Q10)
      q05_current_status: 'entrepreneur',
      q06_years_experience_v2: 'more_than_20',
      // ... all fields

      // WHEN questions (Q11-Q16)
      q11_project_status: ['loi'],
      q14_deal_size: ['3-5M'],
      q15_capital_structure: ['majority_with_minority'],
      q16_equity_contribution: '>450',
    }

    it('transforms form data correctly', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      expect(whoAnswers.q05).toBe('entrepreneur')
    })

    it('calculates WHO score of 100 (maximum)', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)
      expect(result.who.score).toBe(100)
    })
  })
})
```

## Mocking

**Framework:** Vitest's built-in mocking (uses similar API to Jest)

**Current Approach:**
- Minimal mocking in visible tests (project focuses on unit tests of pure functions)
- No mocks for scoring functions - they're deterministic and pure
- Server action tests would mock Supabase client (not yet implemented)

**What to Mock (Guidelines):**
- External API calls (Supabase, email service)
- File system operations
- Time-dependent functions (use `vi.useFakeTimers()`)
- Browser APIs (when testing in Node environment)

**What NOT to Mock:**
- Pure calculation functions (scoring, math utilities)
- Type transformations
- Data mapping functions
- Internal helper functions (test through public API instead)

## Fixtures and Factories

**Test Data:**
- Inline test data in test file using `const` objects
- Example from `intake-integration.test.ts`:
```typescript
interface IntakeFormData {
  first_name: string
  last_name: string
  email: string
  // ... all fields
}

const formData: IntakeFormData = {
  first_name: 'Jean',
  last_name: 'Dupont',
  email: 'jean.dupont@example.com',
  // ... complete data
}
```

**Factory Functions:**
- Transformer functions used as test helpers
- Example: `transformFormToScoringInput(formData)` converts form data to scoring inputs
- Located in test file where used

**Location:**
- Test fixtures live in same test file where used (not extracted to separate fixture files)
- Shared test data extracted into helper functions within test file

## Coverage

**Requirements:** Not enforced (no coverage threshold)

**View Coverage:**
```bash
npm run test:coverage    # Generates text, JSON, HTML reports
```

**Coverage Config (vitest.config.ts):**
- Includes: `lib/**/*.ts` (library code only)
- Excludes: `lib/**/__tests__/**` (test files), `lib/types/**` (type definitions)
- Providers: v8 (built-in coverage tool)
- Outputs: text (console), JSON, and HTML reports

## Test Types

### Unit Tests
**Scope:** Individual pure functions

**Approach:**
- Test function in isolation
- No external dependencies
- Multiple test cases per function: min, max, typical, edge cases
- Example: `scoring-v2.test.ts` tests each scoring function separately

**Example from WHO Score tests:**
```typescript
it('calculates maximum score (100)', () => {
  const answers: WhoAnswers = { /* max score answers */ }
  const result = calculateWhoScore(answers)
  expect(result.score).toBe(100)
  expect(result.breakdown).toEqual({ /* expected breakdown */ })
})
```

### Integration Tests
**Scope:** Multiple components working together (data transformation → scoring)

**Approach:**
- Test complete user journeys
- Validate data consistency across layers
- Use realistic scenario data
- Example: `intake-integration.test.ts` tests form submission to final scoring

**Example pattern:**
```typescript
describe('Scenario: Serial Entrepreneur Ready for Deal Flow', () => {
  const formData: IntakeFormData = { /* full form */ }

  it('transforms form data correctly', () => { /* verify transform */ })
  it('calculates WHO score correctly', () => { /* verify score */ })
  it('generates correct recommendation', () => { /* verify output */ })
})
```

### E2E Tests (Browser/Playwright)
**Type:** Manual browser automation tests (not automated by CI)

**Location:** `scripts/e2e-tests/tests/`

**Framework:** Custom test harness (not Playwright native)

**Test files:**
- `auth.test.ts` - Login, logout, session
- `dashboard.test.ts` - Dashboard rendering
- `repreneurs.test.ts` - Repreneur CRUD
- `pipeline.test.ts` - Pipeline view
- `offers.test.ts` - Offer management
- `questionnaire.test.ts` - Questionnaire form
- `journey.test.ts` - Journey stage tracking
- `guide.test.ts` - Guide/roadmap
- `emails.test.ts` - Email functionality
- `data-validation.test.ts` - Data integrity

**Run pattern (from `auth.test.ts`):**
```typescript
export const authTests: TestSuite = {
  name: "Authentication",
  description: "Login, logout, and session management",
  tests: [
    {
      name: "Login page loads correctly",
      async run(ctx: TestContext): Promise<TestResult> {
        const start = Date.now()
        try {
          await ctx.navigate(ROUTES.login)
          await ctx.wait(1000)

          const emailExists = await ctx.elementExists(SELECTORS.loginEmail)
          // ... assertions

          return pass(this.name, "Login page loaded...", Date.now() - start)
        } catch (error: any) {
          return fail(this.name, error.message, { type: "unknown" }, Date.now() - start)
        }
      }
    }
  ]
}
```

**Usage:** Manual testing harness, not integrated with CI/CD

## Common Patterns

### Async Testing
**Pattern:**
- All async test functions are `async`
- Use `await` for async operations
- No `.then()` chains (use async/await)

**Example from scoring tests:**
```typescript
it('calculates score from async source', async () => {
  const result = await calculateScoreAsync(input)
  expect(result.score).toBe(100)
})
```

### Error Testing
**Pattern:**
- Use `expect().toThrow()` for error cases
- No try-catch in tests (let vitest capture errors)
- Test error types if validation is important

**Example (hypothetical, not in current tests):**
```typescript
it('throws on invalid input', () => {
  expect(() => {
    calculateScore(null)
  }).toThrow()
})
```

### Edge Cases
**Testing strategy:**
- Boundary values (minimum, maximum)
- Empty inputs (empty arrays, null, undefined)
- Type mismatches (if relevant)
- Combinations that don't exist in real usage

**Example from scoring tests (boundaries):**
```typescript
it('minimum score (6)', () => {
  const answers: WhoAnswers = { /* all lowest values */ }
  const result = calculateWhoScore(answers)
  expect(result.score).toBe(6)
})

it('maximum score (100)', () => {
  const answers: WhoAnswers = { /* all highest values */ }
  const result = calculateWhoScore(answers)
  expect(result.score).toBe(100)
})
```

### Special Cases
**Triangulation matrix special cases (from scoring-v2.test.ts):**
```typescript
describe('Special Cases', () => {
  it('TBD equity always = RED (0)', () => {
    expect(calculateTriangulation(['1-3M'], ['majority_without_fund'], 'tbd')).toBe(0)
  })

  it('multi-select returns best score', () => {
    // Testing multiple deal sizes - should return the best combination
    const result = calculateTriangulation(
      ['1-3M', '3-5M'],
      ['majority_with_minority'],
      '351-450'
    )
    expect(result).toBe(2)
  })

  it('empty arrays = RED (0)', () => {
    const result = calculateTriangulation([], ['majority_with_minority'], '>450')
    expect(result).toBe(0)
  })
})
```

## Test Coverage Metrics

**Current Coverage:**
- Focused on critical scoring logic: `lib/utils/scoring-v2.ts`
- Integration flow: `lib/utils/__tests__/intake-integration.test.ts`
- E2E tests for user workflows (manual)

**Not yet covered:**
- Server actions (repreneurs.ts, offers.ts, etc.)
- React components
- Database layer (Supabase integration)

## Test Naming Conventions

**Test names should be descriptive sentences:**
- ✅ `it('calculates maximum score (100)', ...)`
- ✅ `it('returns best score when multiple options selected', ...)`
- ✅ `it('triangulation: 1-3M solo + >450K = GREEN (2)', ...)`
- ❌ `it('test max', ...)`
- ❌ `it('calculate score', ...)`

**Format:**
- Start with verb: "calculates", "returns", "triggers", "throws"
- Include expected result or value when specific
- Use parentheses for numeric expectations: `(100)`, `(2)`

---

*Testing analysis: 2026-01-26*
