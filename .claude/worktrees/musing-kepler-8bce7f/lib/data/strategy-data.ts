export const DIMENSIONS = [
  "Financial Capacity",
  "Industry Expertise",
  "Deal Experience",
  "Operational Capability",
  "Network Strength",
  "Process Maturity",
] as const

export type DimensionKey = (typeof DIMENSIONS)[number]

export interface Phase {
  num: number
  name: string
  question: string
  cert: string
  tier: string
  desc: string
}

export const PHASES: Phase[] = [
  { num: 0, name: "Ideation & Exploration", question: "Should I buy a business?", cert: "Explorer Badge", tier: "Free", desc: "The repreneur explores whether acquisition is the right path. Discovery phase with self-assessment and initial research." },
  { num: 1, name: "Self-Assessment", question: "What kind of buyer am I?", cert: "Profile Verified", tier: "Free", desc: "Self-examination of strengths, gaps, buyer type. Articulating a personal acquisition thesis. WHO score becomes a mirror." },
  { num: 2, name: "Acquisition Thesis", question: "What am I looking for?", cert: "Thesis Validated", tier: "Coaching", desc: "Define target criteria: sectors, geography, deal size, deal-breakers. This becomes the search compass." },
  { num: 3, name: "Financial Preparation", question: "Can I actually afford this?", cert: "Financially Verified", tier: "Pro", desc: "The most critical preparation phase. Understanding financial capacity, French financing stack, and getting bank pre-approval." },
  { num: 4, name: "Advisory Team Assembly", question: "Who's on my team?", cert: "Team Ready", tier: "Pro", desc: "Building the right team: lawyer (M&A), accountant (DD), and ideally an M&A advisor/broker." },
  { num: 5, name: "Deal Sourcing", question: "Where do I find businesses?", cert: "Active Searcher", tier: "Pro", desc: "Active search begins. Engaging with deal platforms, intermediaries, and direct approaches. Pipeline management is critical." },
  { num: 6, name: "Target Evaluation", question: "Is this business worth pursuing?", cert: "Evaluation Competent", tier: "Pro", desc: "Initial evaluation per target: reading financials, normalizing EBITDA, estimating valuation, making go/no-go decisions." },
  { num: 7, name: "Letter of Intent (LOI)", question: "Making it official", cert: "LDC Validated", tier: "Consulting", desc: "Submitting a Lettre de Cadrage (LDC) or Letter of Intent (LOI). Proposed terms, price range, conditions, and exclusivity period." },
  { num: 8, name: "Due Diligence", question: "What am I really buying?", cert: "DD Competent", tier: "Consulting", desc: "The most intensive phase. Comprehensive DD across 6 workstreams: financial, legal, tax, operational, HR, environmental." },
  { num: 9, name: "Negotiation", question: "Getting to the right price", cert: "Negotiation Ready", tier: "Consulting", desc: "Post-DD negotiation of final terms. Price adjustment, GAP structuring, earn-out mechanics, seller financing." },
  { num: 10, name: "Financing Finalization", question: "Getting the money", cert: "Financing Secured", tier: "Consulting", desc: "Securing binding financing commitments. Bank presentations, holding company creation, BPI guarantee applications." },
  { num: 11, name: "Closing", question: "Signing day", cert: "Deal Closed", tier: "Commission", desc: "Legal ownership transfer. The culmination of 12-18 months of work. Primarily administrative but emotionally significant." },
  { num: 12, name: "Transition & Handover", question: "Taking the wheel", cert: "Transition Complete", tier: "Consulting", desc: "Seller hands over operational control. Building trust with existing team while implementing vision. 3-12 months." },
  { num: 13, name: "First 100 Days", question: "Making it yours", cert: "Certified Repreneur", tier: "Recognition", desc: "The critical period determining long-term success. Stabilize operations, achieve quick wins, establish credibility." },
]

export interface Persona {
  id: string
  name: string
  tag: string
  tagColor: "gray" | "blue" | "amber"
  age: number
  role: string
  phase: number
  desc: string
  scores: number[]
  badges: string[]
  subscription: string
  subMonths: number
  target: { sector: string; size: string; region: string }
  revenue: { subscription: number; consulting: number; certification: number; commission: number }
  projectedCommission: number
  projectedDeal: string | null
}

export const PERSONAS: Persona[] = [
  {
    id: "karim",
    name: "Karim",
    tag: "Explorer",
    tagColor: "gray",
    age: 45,
    role: "Operations Director, Logistics",
    phase: 0,
    desc: "Just submitted questionnaire. Beginning the exploration journey.",
    scores: [4, 6, 2, 7, 2, 1],
    badges: ["Explorer Badge"],
    subscription: "Free",
    subMonths: 0,
    target: { sector: "Industrial Services", size: "1-2M EUR", region: "Ile-de-France" },
    revenue: { subscription: 0, consulting: 0, certification: 0, commission: 0 },
    projectedCommission: 0,
    projectedDeal: null,
  },
  {
    id: "sophie",
    name: "Sophie",
    tag: "Active Searcher",
    tagColor: "blue",
    age: 42,
    role: "Ex-COO, Manufacturing",
    phase: 5,
    desc: "Strong operator, actively sourcing deals. Weak on deal experience.",
    scores: [7, 8, 2, 9, 3, 2],
    badges: ["Explorer Badge", "Profile Verified", "Thesis Validated", "Financially Verified", "Team Ready", "Active Searcher"],
    subscription: "Pro (149/mo)",
    subMonths: 4,
    target: { sector: "Manufacturing", size: "2-3M EUR", region: "Rhone-Alpes" },
    revenue: { subscription: 596, consulting: 3300, certification: 0, commission: 0 },
    projectedCommission: 0,
    projectedDeal: null,
  },
  {
    id: "marc",
    name: "Marc",
    tag: "In Deal",
    tagColor: "amber",
    age: 38,
    role: "Pro Subscriber, 10 months",
    phase: 7,
    desc: "Balanced profile, actively evaluating targets. LDC submitted.",
    scores: [8, 6, 5, 7, 6, 7],
    badges: ["Explorer Badge", "Profile Verified", "Thesis Validated", "Financially Verified", "Team Ready", "Active Searcher", "Evaluation Competent", "LDC Validated"],
    subscription: "Pro (149/mo)",
    subMonths: 10,
    target: { sector: "Services / IT", size: "1.5-2.5M EUR", region: "National" },
    revenue: { subscription: 1490, consulting: 6400, certification: 800, commission: 0 },
    projectedCommission: 36000,
    projectedDeal: "2% on 1.8M deal",
  },
]

export const REVENUE_COLORS = {
  subscription: "bg-emerald-500",
  consulting: "bg-amber-500",
  certification: "bg-blue-500",
  commission: "bg-purple-500",
} as const

export const REVENUE_LABELS = {
  subscription: "Subscription",
  consulting: "Consulting",
  certification: "Certification",
  commission: "Commission",
} as const
