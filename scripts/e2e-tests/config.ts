/**
 * E2E Test Configuration
 *
 * Central configuration for all test settings, credentials, and timeouts.
 */

export const TEST_CONFIG = {
  // Target environment
  baseUrl: "https://v0-re-new-2-0.vercel.app",

  // Test credentials (from project docs)
  credentials: {
    email: "bertrand@renew.com",
    password: "testpassword123"
  },

  // Timeouts in milliseconds
  timeouts: {
    navigation: 10000,    // Wait for page navigation
    element: 5000,        // Wait for element to appear
    animation: 500,       // Wait for animations to complete
    action: 2000,         // Wait after an action (click, type)
  },

  // Test data configuration
  testData: {
    prefix: "TEST_E2E_",          // Prefix for test records (easy cleanup)
    emailDomain: "@test-e2e.com", // Email domain for test users
    cleanupBefore: true,          // Clean test data before run
    cleanupAfter: true,           // Clean test data after run
  },

  // Screenshots configuration
  screenshots: {
    enabled: true,
    captureOnFailure: true,
    captureOnSuccess: false,  // Set to true for full visual documentation
  },

  // Report configuration
  reports: {
    directory: "./reports",
    includeTimestamp: true,
    includeScreenshots: true,
  }
}

// Route definitions for navigation
export const ROUTES = {
  login: "/auth/login",
  dashboard: "/dashboard",
  repreneurs: "/repreneurs",
  repreneursNew: "/repreneurs/new",
  repreneursDetail: (id: string) => `/repreneurs/${id}`,
  repreneursQuestionnaire: (id: string) => `/repreneurs/${id}/questionnaire`,
  pipeline: "/pipeline",
  journey: "/journey",
  offers: "/offers",
  offersNew: "/offers/new",
  offersEdit: (id: string) => `/offers/${id}/edit`,
  emails: "/emails",
  guide: "/guide",
}

// CSS selectors and data-testid patterns for finding elements
export const SELECTORS = {
  // Auth
  loginEmail: 'input[type="email"]',
  loginPassword: 'input[type="password"]',
  loginButton: 'button[type="submit"]',
  loginError: '[role="alert"]',

  // Navigation
  sidebar: '[data-testid="sidebar"]',
  navDashboard: 'a[href="/dashboard"]',
  navRepreneurs: 'a[href="/repreneurs"]',
  navPipeline: 'a[href="/pipeline"]',
  navJourney: 'a[href="/journey"]',
  navOffers: 'a[href="/offers"]',

  // Dashboard
  statsCards: '[data-testid="stats-cards"]',
  statCard: '[data-testid="stat-card"]',
  recentRepreneurs: '[data-testid="recent-repreneurs"]',
  topTier1: '[data-testid="top-tier1"]',
  topTier2: '[data-testid="top-tier2"]',

  // Repreneurs
  repreneurTable: 'table',
  repreneurRow: 'tbody tr',
  searchInput: 'input[placeholder*="Search"]',
  statusFilter: '[data-testid="status-filter"]',
  newRepreneurButton: 'a[href="/repreneurs/new"]',

  // Repreneur Form
  firstNameInput: 'input[name="first_name"]',
  lastNameInput: 'input[name="last_name"]',
  emailInput: 'input[name="email"]',
  phoneInput: 'input[name="phone"]',
  submitButton: 'button[type="submit"]',

  // Repreneur Detail
  tier2Stars: '[data-testid="tier2-stars"]',
  notesSection: '[data-testid="notes-section"]',
  noteInput: 'textarea[name="note"]',
  addNoteButton: '[data-testid="add-note"]',

  // Pipeline
  kanbanBoard: '[data-testid="kanban-board"]',
  kanbanColumn: '[data-testid="kanban-column"]',
  kanbanCard: '[data-testid="repreneur-card"]',
  pipelineFilters: '[data-testid="pipeline-filters"]',

  // Journey
  journeyColumns: '[data-testid="journey-columns"]',
  journeyStage: '[data-testid="journey-stage"]',

  // Offers
  offerTable: 'table',
  offerRow: 'tbody tr',
  newOfferButton: 'a[href="/offers/new"]',
  offerNameInput: 'input[name="name"]',
  offerPriceInput: 'input[name="price"]',

  // Emails
  emailTabs: '[data-slot="tabs"]',
  emailTabTrigger: '[data-slot="tabs-trigger"]',
  emailOverviewTab: 'button:has-text("Overview")',
  emailHistoryTab: 'button:has-text("History")',
  emailTemplatesTab: 'button:has-text("Templates")',
  emailManualSendTab: 'button:has-text("Manual Send")',
  emailStatsCard: '[data-testid="email-stats"]',
  emailLogTable: 'table',
  emailTemplateCard: '[data-testid="template-card"]',

  // Guide
  guideContent: '[data-testid="guide-content"]',
}

// Lifecycle status values
export const LIFECYCLE_STATUS = {
  lead: "lead",
  qualified: "qualified",
  client: "client",
  rejected: "rejected",
} as const

// Journey stage values
export const JOURNEY_STAGES = {
  explorer: "explorer",
  learner: "learner",
  ready: "ready",
  serial_acquirer: "serial_acquirer",
} as const
