/**
 * E2E Test Type Definitions
 *
 * TypeScript interfaces for the test framework.
 */

// Test result status
export type TestStatus = "passed" | "failed" | "skipped"

// Error categorization
export type ErrorType = "timeout" | "assertion" | "navigation" | "database" | "element_not_found" | "unknown"

// Test error details
export interface TestError {
  type: ErrorType
  message: string
  stack?: string
  screenshot?: string
}

// Individual test result
export interface TestResult {
  name: string
  status: TestStatus
  message: string
  duration: number        // milliseconds
  screenshot?: string     // filename if captured
  error?: TestError
}

// Test case definition
export interface TestCase {
  name: string
  description?: string
  skip?: boolean          // Skip this test
  run: (context: TestContext) => Promise<TestResult>
}

// Test suite (group of related tests)
export interface TestSuite {
  name: string
  description?: string
  tests: TestCase[]
  beforeAll?: (context: TestContext) => Promise<void>
  afterAll?: (context: TestContext) => Promise<void>
  beforeEach?: (context: TestContext) => Promise<void>
  afterEach?: (context: TestContext) => Promise<void>
}

// Suite execution result
export interface SuiteResult {
  name: string
  results: TestResult[]
  duration: number
  passed: number
  failed: number
  skipped: number
}

// Full test report
export interface TestReport {
  timestamp: string
  environment: string
  duration: number        // total milliseconds
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
    passRate: number      // percentage
  }
  suites: SuiteResult[]
  screenshots: string[]
  errors: TestError[]
}

// Context passed to each test
export interface TestContext {
  tabId: number           // Chrome tab ID
  baseUrl: string
  // Helper functions (implemented in utils)
  navigate: (path: string) => Promise<void>
  waitForNavigation: (expectedPath: string) => Promise<boolean>
  click: (selector: string) => Promise<void>
  type: (selector: string, text: string) => Promise<void>
  selectOption: (selector: string, value: string) => Promise<void>
  getText: (selector: string) => Promise<string>
  elementExists: (selector: string) => Promise<boolean>
  getElementCount: (selector: string) => Promise<number>
  screenshot: (name: string) => Promise<string>
  wait: (ms: number) => Promise<void>
  // Data access
  db: DataValidator
  testData: TestDataManager
}

// Data validator interface (Supabase queries)
export interface DataValidator {
  getRepreneurCount: (status?: string) => Promise<number>
  getRepreneurById: (id: string) => Promise<Repreneur | null>
  getRepreneurByEmail: (email: string) => Promise<Repreneur | null>
  getOfferCount: () => Promise<number>
  getOfferById: (id: string) => Promise<Offer | null>
  getNotesByRepreneurId: (repreneurId: string) => Promise<Note[]>
  verifyTier1Score: (id: string, expectedScore: number) => Promise<boolean>
}

// Test data manager interface
export interface TestDataManager {
  seedTestRepreneur: (data: Partial<RepreneurInsert>) => Promise<string>
  seedTestOffer: (data: Partial<OfferInsert>) => Promise<string>
  seedTestNote: (repreneurId: string, content: string) => Promise<string>
  cleanup: () => Promise<void>
  getCreatedIds: () => { repreneurs: string[]; offers: string[]; notes: string[] }
}

// Repreneur types (simplified from lib/types/repreneur.ts)
export type LifecycleStatus = "lead" | "qualified" | "client" | "rejected"
export type JourneyStage = "explorer" | "learner" | "ready" | "serial_acquirer"

export interface Repreneur {
  id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  linkedin_url?: string
  company_background?: string
  lifecycle_status: LifecycleStatus
  journey_stage?: JourneyStage
  tier1_score?: number
  tier1_score_breakdown?: Record<string, number>
  tier2_stars?: number
  sector_preferences?: string[]
  investment_capacity?: string
  target_acquisition_size?: string
  target_location?: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface RepreneurInsert {
  email: string
  first_name: string
  last_name: string
  phone?: string
  linkedin_url?: string
  company_background?: string
  lifecycle_status?: LifecycleStatus
  journey_stage?: JourneyStage
  sector_preferences?: string[]
  investment_capacity?: string
  target_acquisition_size?: string
  target_location?: string
}

// Offer types
export interface Offer {
  id: string
  name: string
  description?: string
  price: number
  duration_days: number
  acceptance_deadline_days?: number
  includes_hours?: number
  includes_resources?: boolean
  is_active: boolean
  created_at: string
}

export interface OfferInsert {
  name: string
  description?: string
  price: number
  duration_days: number
  acceptance_deadline_days?: number
  includes_hours?: number
  includes_resources?: boolean
  is_active?: boolean
}

// Note types
export interface Note {
  id: string
  repreneur_id: string
  content: string
  note_type?: string
  created_at: string
  created_by?: string
}

// Assertion result
export interface AssertionResult {
  passed: boolean
  message: string
  expected?: unknown
  actual?: unknown
}
