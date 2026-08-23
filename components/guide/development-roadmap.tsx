"use client"

import { Calendar, CheckCircle, Sparkles, Bug, Palette, RefreshCw, Lightbulb, Target, AlertTriangle, Zap, Rocket, type LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { WaveSegmentedMetric, WaveSegmentedSummary } from "@/components/wave/visual-foundations"

// Comprehensive roadmap capturing the full Wave journey
// Product outcomes, product work, UX improvements, validation work, learnings, and features
type RoadmapEventType = "feature" | "product" | "fix" | "style" | "testing" | "audit" | "refactor" | "direction" | "learning" | "decision"

interface RoadmapEvent {
  title: string
  type: RoadmapEventType
  description: string
}

interface RoadmapPeriod {
  period: string
  version: string
  title: string
  isCompleted: boolean
  events: RoadmapEvent[]
}

const roadmapEvents: RoadmapPeriod[] = [
  {
    period: "Aug 23, 2026",
    version: "0.9.55",
    title: "Matching 2.0 makes opportunity fit explainable",
    isCompleted: true,
    events: [
      {
        title: "Client fit now uses the acquisition thesis",
        type: "feature",
        description: "For current paid clients, WAVE compares sector, French geography, revenue, EBITDA margin and team size instead of reusing the earlier qualification scores.",
      },
      {
        title: "Incomplete information stays visible",
        type: "decision",
        description: "A missing opportunity fact is shown for staff confirmation and cannot become a Strong fit; human recommendations and active pursuits remain authoritative.",
      },
      {
        title: "The first calibration is intentionally provisional",
        type: "learning",
        description: "Weights and tolerances live in one named configuration so Bertrand's final parameters and later evidence can refine the numbers without redesigning the matcher.",
      },
    ],
  },
  {
    period: "Aug 21, 2026",
    version: "0.9.54",
    title: "Production screens and email callbacks now behave deterministically",
    isCompleted: true,
    events: [
      {
        title: "Operational dates no longer change while a page hydrates",
        type: "fix",
        description: "Stored timestamps use the Paris operating timezone, civil dates keep their literal day, and moving relative labels wait until the browser has hydrated instead of disagreeing with the server.",
      },
      {
        title: "Production email outcomes now reach the verified callback",
        type: "fix",
        description: "The single Resend production webhook is enabled for all six supported lifecycle events and its signing secret is stored only as an encrypted production setting.",
      },
    ],
  },
  {
    period: "Aug 20, 2026",
    version: "0.9.53",
    title: "Production safeguards are now consistent across the platform",
    isCompleted: true,
    events: [
      {
        title: "The staff follow-up queue now scales as one protected database operation",
        type: "fix",
        description: "WAVE calculates the complete stale-contact queue, its ordering and its total in one staff-only database operation instead of loading each person’s evidence separately.",
      },
      {
        title: "Private file failures stay private and non-cacheable",
        type: "fix",
        description: "Protected document routes now return the same no-store safety headers on success, denial, missing-file and service-failure responses, without exposing database or storage details.",
      },
      {
        title: "Legacy test-data tools are unavailable in production",
        type: "decision",
        description: "Old seed, journey redistribution and unused Wavy suggestion endpoints now stop before authentication or database access in every deployed environment.",
      },
      {
        title: "Recommendation saves always return a clear outcome",
        type: "fix",
        description: "Staff now see an explicit success or safe, actionable error when pushing an opportunity recommendation, while database and infrastructure details remain private.",
      },
      {
        title: "The displayed build number identifies the real release",
        type: "fix",
        description: "WAVE now uses a committed release sequence instead of a deployment checkout’s partial Git history, so the footer remains accurate in production.",
      },
    ],
  },
  {
    period: "Aug 20, 2026",
    version: "0.9.52",
    title: "Protected files and staff workflows are safer and more reliable",
    isCompleted: true,
    events: [
      {
        title: "Every private file request is authorised when it is opened",
        type: "fix",
        description: "WAVE now delivers confidential memoranda, NDA files, staff documents, repreneur documents and External Pursuit attachments without exposing a reusable storage link.",
      },
      {
        title: "Staff opportunity and leadership actions preserve the intended data",
        type: "fix",
        description: "Leadership assessment links now record the staff sender correctly, and an untouched optional sector no longer becomes the first sector in the list.",
      },
      {
        title: "Access and follow-up failures are clearer",
        type: "fix",
        description: "An account without a workspace receives a safe explanation, while the staff follow-up panel fails safely without taking down the dashboard.",
      },
      {
        title: "Email outcomes use the provider’s current signed callback",
        type: "fix",
        description: "Delivery, opening, click, bounce and complaint updates now use Resend’s current signed webhook format and the persisted status contract accepts every supported outcome.",
      },
    ],
  },
  {
    period: "Aug 18, 2026",
    version: "0.9.51",
    title: "Repreneurs can understand protected opportunities more clearly",
    isCompleted: true,
    events: [
      {
        title: "Locked opportunity details remain readable",
        type: "fix",
        description: "When another repreneur is already positioned, the notice now keeps its own space while the title, location, date, sector, reference and metrics remain visible.",
      },
      {
        title: "Read-only opportunity links use plain language",
        type: "style",
        description: "Repreneur pursuit cards now say ‘See opportunity’ while staff wording and every destination remain unchanged.",
      },
    ],
  },
  {
    period: "Aug 16, 2026",
    version: "0.9.50",
    title: "External acquisition work can now inform Re-New without becoming Re-New data",
    isCompleted: true,
    events: [
      {
        title: "Staff can convert one qualified dossier into one controlled Re-New draft",
        type: "feature",
        description: "After choosing a real source office, named contact and approved geography, staff can create one new staff-only opportunity while the external dossier remains separate historical evidence.",
      },
      {
        title: "Conversion never copies private dossier content",
        type: "decision",
        description: "External notes, files, contacts, metrics, ownership and progress do not enter the Re-New opportunity, matching, Pursuit, NDA or disclosure records.",
      },
      {
        title: "Capacity is based on explicit confirmation rather than inferred activity",
        type: "feature",
        description: "Owners and authorised staff can confirm that an external pursuit is current, while staff see separate stage, availability, overdue, stale and unknown totals as of Paris time.",
      },
      {
        title: "M2.1 technical scope is complete; real use still has to prove its value",
        type: "decision",
        description: "The protected External Pursuit workflow is ready for controlled use, but WAVE will treat ongoing maintenance and allocation impact as product evidence rather than assuming adoption.",
      },
    ],
  },
  {
    period: "Aug 16, 2026",
    version: "0.9.49",
    title: "External acquisition work now has one controlled workspace",
    isCompleted: true,
    events: [
      {
        title: "One board keeps external and Re-New work understandable",
        type: "feature",
        description: "Repreneurs can manage their own external acquisition dossiers in one WAVE board, while linked Re-New journey cards remain read-only and keep their existing rules.",
      },
      {
        title: "Follow-up remains an accountable shared record",
        type: "feature",
        description: "Owners and staff can record responsibility, due dates and shared progress; staff-only notes stay private, and WAVE does not send messages or automate follow-up.",
      },
      {
        title: "Private external files stay outside opportunity documents",
        type: "decision",
        description: "Attachments belong only to the dossier owner and authorised staff. They remain separate from Re-New Opportunity Gates, NDA evidence and confidential deal documents.",
      },
      {
        title: "External work stays out of Re-New reporting and matching",
        type: "decision",
        description: "External dossier data never enters matching, source records, Re-New performance indicators or exports, so the two operating models remain trustworthy.",
      },
    ],
  },
  {
    period: "Aug 16, 2026",
    version: "0.9.48",
    title: "External acquisition work now has its own protected foundation",
    isCompleted: true,
    events: [
      {
        title: "External pursuits remain separate from Re-New opportunities",
        type: "decision",
        description: "Independent acquisition dossiers cannot enter matching, source records, confidentiality gates, exports or Re-New performance indicators.",
      },
      {
        title: "Every dossier has one owner and a clear staff boundary",
        type: "feature",
        description: "The owner and authorised Re-New staff can work with the dossier, while other repreneurs and unassigned users are denied and staff-only notes stay separate.",
      },
      {
        title: "Deletion removes the dossier content without erasing accountability",
        type: "decision",
        description: "The owner requests deletion, staff fulfils it, and WAVE retains only the minimum actor-and-time evidence needed to prove that the request was completed.",
      },
      {
        title: "The visible External Pursuit workspace comes next",
        type: "direction",
        description: "This release establishes the protected data and access boundary; progressive intake, the shared board, follow-up and private files remain the next delivery slice.",
      },
    ],
  },
  {
    period: "Aug 15, 2026",
    version: "0.9.47",
    title: "Repreneur matching now starts from shared, complete criteria",
    isCompleted: true,
    events: [
      {
        title: "Staff and repreneurs now maintain one acquisition project",
        type: "feature",
        description: "The full sector, geography, size, investment and operating ranges can be corrected from either side without creating a second version of the target thesis.",
      },
      {
        title: "Automatic discovery waits for enough matching information",
        type: "decision",
        description: "WAVE pauses the wider deal flow when the current matcher lacks a required input, while every opportunity selected by Re-New remains available.",
      },
      {
        title: "The controlled opening can be measured without copying client data",
        type: "feature",
        description: "Entry, discovery, responses, NDA gates and pursuit progress now produce privacy-safe outcome evidence without names, emails, notes, documents or record identifiers.",
      },
      {
        title: "M2 completion still requires real repreneur evidence",
        type: "decision",
        description: "This release establishes technical readiness for a controlled opening; the milestone remains open until the agreed real participants complete and validate the journey.",
      },
    ],
  },
  {
    period: "Aug 14, 2026",
    version: "0.9.46",
    title: "WAVE now responds with one quiet motion system",
    isCompleted: true,
    events: [
      { title: "Operational information appears immediately", type: "fix", description: "Dashboard charts, keyboard navigation and repeated labels no longer delay routine work." },
      { title: "State changes feel consistent", type: "style", description: "Controls share one restrained timing and easing system while unnecessary property animation is removed." },
      { title: "Motion remains accessible", type: "fix", description: "Reduced-motion users keep useful color and opacity feedback without movement." },
      { title: "Rare decisions receive restrained confirmation", type: "style", description: "Button press, decline disclosure and fresh submission success now explain what happened without decorative motion." },
    ],
  },
  {
    period: "Aug 12, 2026",
    version: "0.9.45",
    title: "New opportunities now start with a stable source and reference",
    isCompleted: true,
    events: [
      {
        title: "New source choices stay selected",
        type: "fix",
        description: "When staff create a firm or office while adding an opportunity, WAVE keeps that office selected so they can continue in the same form. A first contact is selected only when the new firm flow created one.",
      },
      {
        title: "New opportunities receive one permanent reference",
        type: "feature",
        description: "After staff choose the opportunity geography, WAVE assigns a unique mandate reference that remains attached to that record.",
      },
      {
        title: "Geography is recorded before a reference is assigned",
        type: "decision",
        description: "Staff choose France, a broad area or a region. Existing locations and references remain intact, and matching rules do not change in this phase.",
      },
      {
        title: "Legacy opportunity dates now reflect the CRM source",
        type: "fix",
        description: "Six historic dates are corrected against the original CRM file, and a source that supplied only a month continues to display only that month.",
      },
    ],
  },
  {
    period: "Aug 12, 2026",
    version: "0.9.44",
    title: "M&A office work is clearer and faster",
    isCompleted: true,
    events: [
      {
        title: "Office contacts now show their email address",
        type: "feature",
        description: "Staff can see each linked contact's email directly from the office workspace, without opening the contact or adding another editing route.",
      },
      {
        title: "Each M&A page now has one navigation system",
        type: "fix",
        description: "Activity, Firms and Contacts use their dedicated sidebar routes without a second in-page tab switcher that could show content from the wrong route.",
      },
    ],
  },
  {
    period: "Aug 9, 2026",
    version: "0.9.43",
    title: "M&A relationship workspaces now support daily staff work",
    isCompleted: true,
    events: [
      {
        title: "Activity now distinguishes manual records from system-recorded delivery",
        type: "feature",
        description: "Staff can see whether an activity was entered as evidence or is backed by confirmed provider delivery, without WAVE claiming that a manually recorded email was sent.",
      },
      {
        title: "Each operating office has one staff workspace",
        type: "feature",
        description: "Staff can review the office's contacts, source opportunities, activity, indicators and internal notes, then add a new person or affiliate an existing person without duplicating identity.",
      },
      {
        title: "Firm workspaces combine offices without changing ownership",
        type: "decision",
        description: "Firm pages bring together their offices and derived relationship information, while opportunities and activity remain owned by their operating office. Staff can add a real office through the existing controlled workflow.",
      },
    ],
  },
  {
    period: "Aug 8, 2026",
    version: "0.9.42",
    title: "M&A firms are now faster to reach and compare",
    isCompleted: true,
    events: [
      {
        title: "Activity, Firms and Contacts have direct staff navigation",
        type: "feature",
        description: "The staff sidebar now treats M&A as its own operating area, with stable direct routes, breadcrumbs and safe redirects from the former Relationships view.",
      },
      {
        title: "Firm and office indicators reconcile with canonical records",
        type: "feature",
        description: "Staff can search one compact firm list, expand each firm into its offices and compare distinct active contacts, sourced opportunities, open work, candidate-stale items and the latest known opportunity date.",
      },
      {
        title: "Indicator details remain read-only and office-centred",
        type: "decision",
        description: "Firm totals are derived through canonical offices, aggregates are never persisted and the new firm and office indicator pages add no relationship mutation or repreneur visibility.",
      },
    ],
  },
  {
    period: "Aug 8, 2026",
    version: "0.9.41",
    title: "Staff forms now explain and resolve missing information",
    isCompleted: true,
    events: [
      {
        title: "Required and optional fields are explicit",
        type: "style",
        description: "Staff forms now state what must be completed, what may be left blank and which information is required only for a later opportunity step.",
      },
      {
        title: "A failed save points to every field that needs attention",
        type: "fix",
        description: "WAVE preserves entered values, shows a persistent summary with links to each invalid field and explains the correction beside that field instead of relying on a transient browser message.",
      },
    ],
  },
  {
    period: "Aug 8, 2026",
    version: "0.9.40",
    title: "Blank NDA templates can keep their Word format",
    isCompleted: true,
    events: [
      {
        title: "Staff can retain the intermediary's original template format",
        type: "feature",
        description: "A blank NDA template may now be uploaded as PDF or Word, and the active repreneur downloads the exact version released through Gate 1.",
      },
      {
        title: "Final evidence remains simple and fixed",
        type: "decision",
        description: "Signed NDA copies and the Information Memorandum remain PDF-only. Editing, conversion and signing still happen outside WAVE.",
      },
    ],
  },
  {
    period: "Aug 7, 2026",
    version: "0.9.39",
    title: "The opportunity-to-memo journey is now controlled end to end",
    isCompleted: true,
    events: [
      {
        title: "One journey now connects opportunity creation to the confidential memo",
        type: "feature",
        description: "Staff can create the source office and opportunity, recommend a repreneur, validate interest, complete both NDA gates, record the manual intermediary handoff, grant the exact Information Memorandum and record the outcome.",
      },
      {
        title: "Every pursuit earns confidential access independently",
        type: "decision",
        description: "A dropped or completed pursuit loses access immediately, and a later repreneur inherits neither the signed documents nor the source or Information Memorandum grant.",
      },
      {
        title: "Creation and document actions now confirm what actually happened",
        type: "fix",
        description: "Opportunity creation returns the persisted record or clear field errors, and the shared document controls provide consistent upload, view, download, locked, success and failure states.",
      },
      {
        title: "Signing and intermediary communication remain manual",
        type: "decision",
        description: "WAVE stores final PDF evidence, validations, grants and outcomes; document editing, signing, email exchange and post-memo negotiations continue outside the platform.",
      },
    ],
  },
  {
    period: "Aug 7, 2026",
    version: "0.9.38",
    title: "Staff can export opportunity data and ask WAVE AI what to do next",
    isCompleted: true,
    events: [
      {
        title: "Opportunity data is available as a reliable staff export",
        type: "feature",
        description: "Staff can download one row per opportunity with its current pipeline position, matching context, source information, internal notes and calculated EBITDA margin.",
      },
      {
        title: "WAVE AI can recommend existing actions from recorded facts",
        type: "feature",
        description: "On an opportunity, staff can request up to three next actions that separate recorded facts, inference and unknown information and link only to controls already available in WAVE.",
      },
      {
        title: "Staff remains responsible for every business action",
        type: "decision",
        description: "Luna can rank and explain available actions, but it cannot invent a workflow, change a record or confirm an action on behalf of the team.",
      },
    ],
  },
  {
    period: "Aug 6, 2026",
    version: "0.9.37",
    title: "WAVE AI now helps staff prepare reviewed email drafts",
    isCompleted: true,
    events: [
      {
        title: "Staff can create a draft from current WAVE context",
        type: "feature",
        description: "Choose a repreneur, purpose and language to create an editable draft from the limited profile information needed for that task.",
      },
      {
        title: "Every AI result remains under staff control",
        type: "decision",
        description: "WAVE AI cannot send messages or change business records. Staff must review, edit and copy the draft before using it.",
      },
      {
        title: "AI use, reliability and estimated cost are now visible",
        type: "feature",
        description: "The staff usage view measures attempts, useful outcomes, latency, tokens and estimated cost without storing prompts, drafts or personal details.",
      },
    ],
  },
  {
    period: "Jul 30, 2026",
    version: "0.9.36",
    title: "Every eligible deal now has a clear, safer next action",
    isCompleted: true,
    events: [
      {
        title: "Repreneurs can express interest across the full eligible deal flow",
        type: "feature",
        description: "Unassigned and already-positioned opportunities now accept the same interest signal as staff-selected deals, without creating a pursuit, queue, reassignment or new disclosure.",
      },
      {
        title: "Existing pursuits remain protected",
        type: "decision",
        description: "A signal on a positioned opportunity leaves the current candidate and pursuit untouched, while staff receives wording that reflects whether the deal is unassigned or already in pursuit.",
      },
      {
        title: "Portal access changes fail before an invalid recipient can be used",
        type: "fix",
        description: "Staff can see the exact portal recipient before acting; malformed addresses block access grants, repairs and resends while emergency revocation remains available.",
      },
    ],
  },
  {
    period: "Jul 30, 2026",
    version: "0.9.35",
    title: "Contact email preferences now protect every M&A workflow",
    isCompleted: true,
    events: [
      {
        title: "A do-not-email decision now follows the person",
        type: "feature",
        description: "Campaign and general relationship outreach are blocked across every office affiliation, even when someone tries to use the contact's address directly.",
      },
      {
        title: "Deal-specific NDA work keeps one controlled exception",
        type: "decision",
        description: "A protected contact can receive only an NDA request from an opportunity to which they are actively linked; WAVE checks and records that exception before delivery.",
      },
      {
        title: "Every preference change remains accountable",
        type: "feature",
        description: "Staff can review the current warning and change the policy only with a reason, while the original import note and immutable change history remain available.",
      },
    ],
  },
  {
    period: "Jul 29, 2026",
    version: "0.9.34",
    title: "WAVE’s newest workflows are now easier to scan and act on",
    isCompleted: true,
    events: [
      {
        title: "Relationships now brings the directory and timeline together",
        type: "feature",
        description: "Staff can move between the relationship timeline, intermediary firms and contacts in one workspace, while mobile keeps the latest activity ahead of optional filters.",
      },
      {
        title: "Recording activity starts with the evidence that matters",
        type: "style",
        description: "Required activity details now come first, optional follow-up information stays available on demand, and the save action remains visible on desktop and mobile.",
      },
      {
        title: "Repreneurs can compare more opportunities at a glance",
        type: "style",
        description: "The deal flow now uses compact, ranked rows that preserve the core title, geography, status and financial context while leaving the full narrative in deal detail.",
      },
      {
        title: "Portal decisions and document gates explain the next step",
        type: "fix",
        description: "Memo availability now follows the verified NDA and document state, while decline reasons appear only after a repreneur chooses Not a fit.",
      },
      {
        title: "Inactive NDA evidence no longer looks actionable",
        type: "decision",
        description: "The reusable blank NDA remains available at all times; pursuit-specific signed copies stay as compact history summaries until an active pursuit exists.",
      },
    ],
  },
  {
    period: "Jul 28, 2026",
    version: "0.9.33",
    title: "WAVE is now the operating source of truth for opportunities",
    isCompleted: true,
    events: [
      {
        title: "Colin's final workbook is now live in WAVE",
        type: "product",
        description: "All 148 opportunity references were reconciled into the platform alongside 229 firms, 431 offices and 575 named contacts, so the team can now run the opportunity base from one shared workspace.",
      },
      {
        title: "Existing work and history were preserved",
        type: "decision",
        description: "The switch updated 111 existing opportunities in place and added 37 missing records as staff-only drafts without replacing public titles, matches, documents or relationship history.",
      },
      {
        title: "Uncertain data remains visible review work",
        type: "decision",
        description: "Missing public titles, broad sector labels, unresolved geography and ambiguous repreneur positioning remain explicit staff queues instead of being guessed during import.",
      },
      {
        title: "Excel is now read-only",
        type: "product",
        description: "WAVE is authoritative for this workbook snapshot. Corrections and ongoing opportunity work should happen in the platform so the team does not create two competing records.",
      },
    ],
  },
  {
    period: "Jul 27, 2026",
    version: "0.9.32",
    title: "M&A relationship history is now one usable staff workspace",
    isCompleted: true,
    events: [
      {
        title: "One timeline follows the relationship, not only the opportunity",
        type: "product",
        description: "Staff can review calls, emails, meetings, documents and other activity in one chronological record, including work that starts before an opportunity exists.",
      },
      {
        title: "Existing intermediary emails kept their original evidence",
        type: "decision",
        description: "The four existing records retain their source, office, contact, recipient and delivery history, while Bertrand can personally verify the provisional ownership recorded during migration.",
      },
      {
        title: "New activity can be recorded without accidentally sending anything",
        type: "feature",
        description: "Manual relationship capture is staff-only, requires consistent office and contact context, and treats an email entry as evidence of a communication that already happened rather than a send command.",
      },
      {
        title: "Source corrections and relationship history cannot contradict each other",
        type: "fix",
        description: "Unresolved provisional sources must be corrected before permanent opportunity-linked history is added, and concurrent source changes are serialized so the office record stays consistent.",
      },
    ],
  },
  {
    period: "Jul 27, 2026",
    version: "0.9.31",
    title: "Provisional M&A sources now have a controlled staff review path",
    isCompleted: true,
    events: [
      {
        title: "Incomplete source data can enter active work without becoming permanent history",
        type: "product",
        description: "One controlled Acme Co. / Acme Paris context can support Draft, Active and Paused work while terminal and cutover treatment remain blocked until staff verifies the real source.",
      },
      {
        title: "Staff can see and correct every provisional source",
        type: "feature",
        description: "Find, Groups and opportunity detail surface one staff-only review signal, and the correction workflow atomically replaces Acme with the real office and valid contacts.",
      },
      {
        title: "Corrections preserve immutable evidence",
        type: "decision",
        description: "Each assignment and resolution retains actor, time, reason, old source and new source without recreating the opportunity or rewriting its history.",
      },
      {
        title: "Provisional context stays outside the repreneur portal",
        type: "fix",
        description: "Acme, review metadata and correction evidence remain staff-only, while external intermediary email fails closed until the source is resolved.",
      },
    ],
  },
  {
    period: "Jul 26, 2026",
    version: "0.9.30",
    title: "Opportunity intake moved to one authoritative M&A relationship model",
    isCompleted: true,
    events: [
      {
        title: "Operating offices now anchor opportunity sources",
        type: "product",
        description: "Staff work from one firm, operating-office, and contact structure instead of maintaining a second firm-level source relationship.",
      },
      {
        title: "Draft early, activate only when the relationship is usable",
        type: "feature",
        description: "A reference is enough to start a staff-only draft, while active and paused opportunities require a source office, description, named contacts, one primary contact, and a usable primary email.",
      },
      {
        title: "Several contacts can stay attached to one opportunity",
        type: "feature",
        description: "Staff can select several people affiliated with the same operating office and choose exactly one primary recipient without merging or overwriting the others.",
      },
      {
        title: "The workbook switch remains controlled and separate",
        type: "decision",
        description: "The old browser importer is retired and a synthetic rehearsal now proves the one-time cutover rules. No real workbook has been imported, and Excel remains authoritative until the separately approved switch.",
      },
    ],
  },
  {
    period: "Jul 24, 2026",
    version: "0.9.29",
    title: "Portal decisions and opportunity operations made more reliable",
    isCompleted: true,
    events: [
      {
        title: "Repreneurs can respond with confidence",
        type: "fix",
        description: "Interest signals now complete reliably, while declines capture both a consistent reason and the written context staff need to improve future matching.",
      },
      {
        title: "Portal access can be resent without disruption",
        type: "fix",
        description: "Healthy accounts receive another access link without rotating credentials or sessions, while broken account mappings show one explicit repair path.",
      },
      {
        title: "New opportunities start with a clear public identity",
        type: "feature",
        description: "Every new opportunity now has a prominent repreneur-facing title, simpler staff intake, and import diagnostics that prevent unclear records from entering the workspace.",
      },
      {
        title: "Opportunity geography reflects what is actually known",
        type: "decision",
        description: "Portal cards and details preserve the attached geography label instead of assuming every location has regional precision.",
      },
    ],
  },
  {
    period: "Jul 22, 2026",
    version: "0.9.28",
    title: "M&A firms and contacts made easier to navigate and maintain",
    isCompleted: true,
    events: [
      {
        title: "Related intermediary firms stay together",
        type: "feature",
        description: "Staff can assign related firms to a named network and see those firms together, while independent firms remain in a simple ungrouped list.",
      },
      {
        title: "Contact changes preserve the past",
        type: "decision",
        description: "A contact can move to a new firm or email without rewriting the source and contact details already attached to earlier opportunities; every old-to-new change remains visible in immutable staff history.",
      },
      {
        title: "M&A now has dedicated Firms and Contacts pages",
        type: "feature",
        description: "The navigation separates firm management from the global contact directory, making it faster to search, edit, regroup, and move intermediary records.",
      },
    ],
  },
  {
    period: "Jul 22, 2026",
    version: "0.9.27",
    title: "Intermediary relationships expanded behind a stricter confidentiality wall",
    isCompleted: true,
    events: [
      {
        title: "One intermediary can now involve several contacts",
        type: "feature",
        description: "Staff can keep one firm record, add the relevant people, link the right contacts to each opportunity, and choose the default recipient for intermediary follow-up without overwriting another deal's contact.",
      },
      {
        title: "Live opportunities keep a verified source",
        type: "decision",
        description: "An opportunity can become active only when it points to a canonical M&A source, preserving provenance while keeping firm, contact, and internal context out of the repreneur experience.",
      },
      {
        title: "Confidential access now depends on recorded evidence",
        type: "fix",
        description: "Raw internal teaser text is suppressed, browser roles cannot query staff-only opportunity records directly, and confidential deal books require both recorded NDA evidence and an explicit staff approval before a repreneur can open them.",
      },
    ],
  },
  {
    period: "Jul 20, 2026",
    version: "0.9.26",
    title: "Matching language aligned and memo access announced",
    isCompleted: true,
    events: [
      {
        title: "One sector language from intake to deal flow",
        type: "feature",
        description: "Repreneurs and staff now use the same 16-sector taxonomy across intake, opportunity records, filters, imports, and matching. Broad legacy Services and Santé records remain discoverable without guessing a narrower classification.",
      },
      {
        title: "Repreneurs hear when a confidential memo is ready",
        type: "fix",
        description: "Each eligible pursuit now receives one notification only after the NDA is signed or waived and a real approved memo is available, while later document edits cannot send duplicates.",
      },
      {
        title: "Legacy data is corrected without invented choices",
        type: "decision",
        description: "Unambiguous historic sectors are remapped with rollback evidence, while 24 broad Services or Santé opportunity records stay compatible and await precise staff classification instead of being rewritten by assumption.",
      },
    ],
  },
  {
    period: "Jul 20, 2026",
    version: "0.9.25",
    title: "Opportunity integrity and confidentiality strengthened",
    isCompleted: true,
    events: [
      {
        title: "Confidential memos open only after the real gate is complete",
        type: "fix",
        description: "NDA receipt, completed signature, source-identity disclosure, and actual memo availability are now treated as separate facts, so a repreneur sees an approved memo only after a signed or waived NDA and a real file are both present.",
      },
      {
        title: "Incomplete opportunity data is visible before saving",
        type: "product",
        description: "Staff receive a non-blocking warning when matching-critical financial, headcount, source, or contact data is missing, can explicitly save unknown values, and keep numeric zero distinct from missing data.",
      },
      {
        title: "Opportunity closure decisions remain auditable",
        type: "feature",
        description: "Closing an opportunity now records a structured reason and durable history, while reopening restores active work without erasing the earlier decision.",
      },
    ],
  },
  {
    period: "Jul 18, 2026",
    version: "0.9.24",
    title: "Repreneur decisions and opportunity intake made dependable",
    isCompleted: true,
    events: [
      {
        title: "Portal decisions fail safely",
        type: "fix",
        description: "Repreneurs must now choose a reason before declining a proposed opportunity, Other requires context, and recoverable problems appear beside the decision instead of breaking the portal journey.",
      },
      {
        title: "Owned framing letters open from Profile",
        type: "fix",
        description: "A repreneur can open their own Lettre de Cadrage while other users' documents and staff-only document types remain protected.",
      },
      {
        title: "Proposed deal detail access protected",
        type: "testing",
        description: "The reported proposed-deal record and a live QA journey were verified in production, with regression coverage preserving match ownership, visibility checks, and safe not-found behavior.",
      },
      {
        title: "New opportunities use the agreed sector choices",
        type: "feature",
        description: "Staff creating an opportunity choose from the 16 agreed sectors, with a required precise description for Other, while existing opportunity records remain unchanged.",
      },
    ],
  },
  {
    period: "Jul 17, 2026",
    version: "0.9.23",
    title: "Opportunity review made clearer and more consistent",
    isCompleted: true,
    events: [
      {
        title: "Complete opportunity information in the repreneur portal",
        type: "feature",
        description: "Opportunity cards and profile rows now show the Re-New reference, anonymized name, location, sector, summary, revenue, EBITDA, margin, team size, and date added while keeping source and internal information private.",
      },
      {
        title: "Decline reasons aligned across staff workflows",
        type: "fix",
        description: "Staff declining an offer from Engagement now select the same reason categories used elsewhere, with optional context, so feedback can be reviewed consistently.",
      },
    ],
  },
  {
    period: "Jul 15, 2026",
    version: "0.9.22",
    title: "Courteous interest signals for positioned opportunities",
    isCompleted: true,
    events: [
      {
        title: "Positioned opportunities stay visible",
        type: "feature",
        description: "Repreneurs can still see an anonymized opportunity when another candidate is already positioned, with a clear explanation of Re-New's one-candidate-at-a-time principle.",
      },
      {
        title: "Interest reaches Re-New without creating competition",
        type: "decision",
        description: "A repreneur can send one private interest signal for direct staff follow-up. The signal creates no public queue, ranking, timer, automatic reassignment, or competition between candidates.",
      },
    ],
  },
  {
    period: "Jul 14, 2026",
    version: "0.9.21",
    title: "WAVE design quality gate enforced",
    isCompleted: true,
    events: [
      {
        title: "Recognizable design artifacts caught before release",
        type: "decision",
        description: "Every interface change now passes an automatic Re-New design check, and concrete visual artifacts must be corrected before the work can be called complete.",
      },
      {
        title: "Visual noise removed across the product",
        type: "style",
        description: "Decorative accent borders, repeated metric cards, heavy shadow cards, gradients, and stripes were removed. Compact uppercase labels were retained and standardized as a governed Re-New pattern.",
      },
      {
        title: "Polish separated from product strategy",
        type: "decision",
        description: "Impeccable is limited to visual implementation quality. KPIs, workflows, hierarchy, information architecture, filters, and strategy remain outside its scope.",
      },
    ],
  },
  {
    period: "Jul 12, 2026",
    version: "0.9.20",
    title: "WAVE interface rebuilt as one operating system",
    isCompleted: true,
    events: [
      {
        title: "One calm workspace shell",
        type: "style",
        description: "Navigation, page headers, typography, spacing, cards, tables, forms, tabs, and states now follow one mature Re-New visual language across staff and portal screens.",
      },
      {
        title: "Dashboards made operational",
        type: "product",
        description: "Repreneur and opportunity dashboards now prioritize a compact KPI rail, the decisions that need attention, larger analytical regions, and recent work instead of equal-weight shortcut cards.",
      },
      {
        title: "Directories and pipeline rationalized",
        type: "feature",
        description: "Find, Groups, M&A, pipeline, offers, and review queues use denser work surfaces, clearer actions, progressive filters, and consistent table behavior.",
      },
      {
        title: "Records and forms given a clear hierarchy",
        type: "style",
        description: "Repreneur and opportunity records now lead with identity, status, and next actions, while forms group related decisions and keep secondary information quieter.",
      },
      {
        title: "External journeys brought into the same family",
        type: "style",
        description: "Login, intake, assessment, and repreneur portal screens now share WAVE branding and product discipline without exposing the complexity of the staff workspace.",
      },
      {
        title: "Charts governed by the Re-New chart layer",
        type: "decision",
        description: "The remaining email-volume visualization was migrated into the WAVE EvilCharts layer, completing the rule that product charts use one accessible, reusable system.",
      },
    ],
  },
  {
    period: "Jul 12, 2026",
    version: "0.9.19",
    title: "Wave 2.0 design foundation introduced",
    isCompleted: true,
    events: [
      {
        title: "Cleaner filters for large directories",
        type: "feature",
        description: "Repreneur Find, Opportunity Find and Groups, and the M&A directory now keep search visible while letting staff add, edit, and remove only the filters they need.",
      },
      {
        title: "Filtered views can be shared",
        type: "product",
        description: "Search and filter choices are stored in the page link, so a useful operational view can be bookmarked or sent to a colleague.",
      },
      {
        title: "One chart language across Wave",
        type: "decision",
        description: "All product charts now pass through a Re-New-owned layer built on EvilCharts, with a restrained palette, accessible data alternatives, and consistent behavior.",
      },
      {
        title: "Design choices made reusable",
        type: "style",
        description: "A staff-visible design system page and written product UI contract now define the components and visual rules future work should reuse.",
      },
    ],
  },
  {
    period: "May 22, 2026",
    version: "0.9.18",
    title: "Staff navigation made faster",
    isCompleted: true,
    events: [
      {
        title: "Dashboard page switching stabilized",
        type: "fix",
        description: "Staff navigation now keeps the dashboard frame responsive instead of making each page switch feel like a fresh rebuild.",
      },
      {
        title: "Common staff data kept warm",
        type: "product",
        description: "Repreneur lists, pipeline views, analytics, and opportunity work surfaces now reuse short-lived dashboard snapshots so staff do not wait on the same data repeatedly.",
      },
      {
        title: "Pages load what they need",
        type: "refactor",
        description: "The main staff pages now ask for smaller, purpose-built data sets instead of repeatedly pulling broad records that were not needed for the current screen.",
      },
      {
        title: "Edits still refresh correctly",
        type: "product",
        description: "When staff change repreneurs, opportunities, matches, activities, or related workflow data, the affected dashboard snapshots are refreshed immediately.",
      },
      {
        title: "Database indexes prepared",
        type: "refactor",
        description: "The release includes index migrations for the filters and date ordering used by daily staff dashboard work.",
      },
      {
        title: "Before and after timing captured",
        type: "testing",
        description: "Six authenticated staff routes were measured against the previous committed build. The biggest waits were removed on Opportunities Find and repreneur detail navigation.",
      },
    ],
  },
  {
    period: "May 19, 2026",
    version: "0.9.17",
    title: "Staff portal preview added",
    isCompleted: true,
    events: [
      {
        title: "Staff-only portal preview opened",
        type: "feature",
        description: "Staff now have a Portal Preview page where they can choose a repreneur and see the portal using that repreneur's real production data.",
      },
      {
        title: "Preview access surfaced in daily work",
        type: "style",
        description: "A Portal Preview button was added to the staff dashboard header, with a supporting dashboard card for easier discovery during review and support work.",
      },
      {
        title: "Real visibility rules reused",
        type: "product",
        description: "The preview uses the same deal list, deal detail, profile, document visibility, NDA, and active-pursuit rules that a repreneur would see.",
      },
      {
        title: "No impersonation boundary protected",
        type: "audit",
        description: "Staff stay logged in as staff. They can inspect what a repreneur would see, but response actions are disabled so they cannot accidentally mark a deal as interested or not a fit.",
      },
      {
        title: "Production preview verified",
        type: "testing",
        description: "The live build was checked through the header preview entry point and verified on production as build 10.5471815.",
      },
    ],
  },
  {
    period: "May 19, 2026",
    version: "0.9.16",
    title: "Repreneur portal recovered and access management strengthened",
    isCompleted: true,
    events: [
      {
        title: "Repreneur login path recovered",
        type: "fix",
        description: "Repreneur users now land correctly on the portal after login, while staff and repreneur routes redirect back to the right workspace when someone tries to enter the wrong area.",
      },
      {
        title: "Portal identity made reliable",
        type: "product",
        description: "The app now resolves the linked repreneur record once and uses it consistently across portal deals, profile, deal responses, document downloads, and post-login routing.",
      },
      {
        title: "Staff-controlled portal access added",
        type: "feature",
        description: "Each repreneur profile now shows portal access status and linked account status, with staff actions to enable access, resend setup links, or disable access.",
      },
      {
        title: "Repreneur deal experience restored",
        type: "product",
        description: "Repreneurs can see curated opportunities, open deal details, respond interested or not a fit, and view active-pursuit stage, NDA state, and approved documents when allowed.",
      },
      {
        title: "Document privacy boundary verified",
        type: "audit",
        description: "Only documents approved for repreneurs are visible or downloadable, staff-only files stay blocked, and NDA status is respected before document access opens.",
      },
      {
        title: "Portal freshness and session fixes",
        type: "fix",
        description: "Portal pages now render fresh per request, avoiding stale or cross-user cached data, and a logout prefetch issue that silently killed repreneur sessions was fixed.",
      },
      {
        title: "Repreneur-side production UAT completed",
        type: "testing",
        description: "Production UAT covered login, portal navigation, proposed and active-pursuit deals, signed NDA state, approved document opening, staff-document blocking, profile access, and route protection both ways.",
      },
      {
        title: "Repreneur UAT made a release gate",
        type: "audit",
        description: "Project memory now records that staff/admin checks are not enough: repreneur-facing production UAT is mandatory before external portal behavior is considered covered.",
      },
    ],
  },
  {
    period: "May 18-19, 2026",
    version: "0.9.15",
    title: "Intermediary follow-up workflow activated",
    isCompleted: true,
    events: [
      {
        title: "M&A tab added to opportunity detail",
        type: "feature",
        description: "Each linked-source opportunity now has an M&A tab where staff can see the source contact, choose a broker email template, and work from the opportunity context.",
      },
      {
        title: "Broker messages sent from the deal page",
        type: "product",
        description: "Staff can review, edit, and send an intermediary follow-up without leaving the opportunity. This turns the earlier template foundation into a real operating workflow.",
      },
      {
        title: "Interaction history logged",
        type: "feature",
        description: "Sent intermediary emails are recorded on the opportunity, with status, recipient, subject, timestamp, and any send error visible for follow-up.",
      },
      {
        title: "Missing-email guard added",
        type: "fix",
        description: "If the linked M&A source has no email address, the send action stays disabled and the page explains what must be added before staff can contact the source.",
      },
      {
        title: "Production send path hardened",
        type: "fix",
        description: "The workflow was tightened through live UAT fixes: protected API sending, required email metadata, reliable logging, and Better Auth / Supabase ownership mismatch handling.",
      },
      {
        title: "Production UAT completed",
        type: "testing",
        description: "The live app was checked with a linked-source opportunity, template switching, blocked no-email send, successful outbound email, refreshed history, database evidence, and cleanup of marked UAT records.",
      },
    ],
  },
  {
    period: "May 18, 2026",
    version: "0.9.14",
    title: "Staff work surfaces, KPI system, and M&A source foundation",
    isCompleted: true,
    events: [
      {
        title: "Repreneur Find and Groups aligned",
        type: "style",
        description: "Repreneur Groups and Find now share the same header, filter shell, result counts, pagination behavior, and table safety for dense staff review work.",
      },
      {
        title: "Opportunity Find and Groups added",
        type: "feature",
        description: "Opportunities now have the same operating split as repreneurs: Find for full-list search and Groups for bucket-based daily work, while Records remains available.",
      },
      {
        title: "Opportunity journey labels made scannable",
        type: "product",
        description: "Opportunity tables now show derived journey labels such as Live inventory, Matching, Interest received, Active pursuit, Seller meeting, LOI, Closed, Dropped, Paused, and Archived.",
      },
      {
        title: "KPI tiles and match scoring standardized",
        type: "product",
        description: "Dashboard KPIs and recommendation scores now use a locked metric system, shared visual tiles, and centralized scoring logic so product signals stay consistent across pages.",
      },
      {
        title: "Recommendation preview restored",
        type: "fix",
        description: "The platform recommendation preview was repaired and the recommendation form now returns clearer feedback when staff save or adjust opportunity matches.",
      },
      {
        title: "Save feedback standardized",
        type: "style",
        description: "Staff actions now use a consistent toast feedback pattern, making successful saves and blocked actions easier to understand across the product.",
      },
      {
        title: "M&A source directory added",
        type: "feature",
        description: "The Opportunities area now has an M&A page where staff can manage intermediary firms, source types, contact names, emails, phone numbers, notes, and linked opportunity coverage.",
      },
      {
        title: "Opportunity sources normalized",
        type: "fix",
        description: "Existing opportunity source labels were backfilled into source records so contacts can be edited once and reused across the opportunity workflow.",
      },
      {
        title: "Intermediary email templates seeded",
        type: "feature",
        description: "Email Tools now include broker-facing templates for opportunity validity checks, missing information, repreneur interest feedback, and process follow-up.",
      },
      {
        title: "Work-surface validation completed",
        type: "testing",
        description: "Build, route rendering, journey helper tests, authenticated browser checks, M&A directory smoke checks, and template visibility checks were captured before closing the phase.",
      },
    ],
  },
  {
    period: "May 18, 2026",
    version: "0.9.13",
    title: "Email cockpit extended for deal-flow communication",
    isCompleted: true,
    events: [
      {
        title: "Template manager shows audience context",
        type: "feature",
        description: "Email templates now show whether they serve repreneur communication. The same structure can host opportunity templates as deal-flow email use cases are added.",
      },
      {
        title: "Manual-send flow prepared for opportunity messages",
        type: "product",
        description: "The existing send workflow can now grow toward opportunity-specific communication without rebuilding the email cockpit from scratch.",
      },
      {
        title: "Email navigation clarified",
        type: "style",
        description: "Email now sits inside Tools beside Wavy, making it easier to find as a shared operations surface rather than a repreneur-only page.",
      },
    ],
  },
  {
    period: "May 17, 2026",
    version: "0.9.12",
    title: "Product navigation and workspaces cleaned up",
    isCompleted: true,
    events: [
      {
        title: "Repreneur and opportunity areas separated",
        type: "style",
        description: "The sidebar now separates Repreneurs, Opportunities, Tools, and Project so the team can switch between people work and deal work without mixed menus.",
      },
      {
        title: "Repreneur dashboard made explicit",
        type: "product",
        description: "The existing dashboard and analytics views now clearly belong to repreneur pipeline health instead of acting as generic catch-all pages.",
      },
      {
        title: "Opportunity operations workspace added",
        type: "feature",
        description: "A dedicated opportunity dashboard now focuses on stale follow-ups, pending responses, active pursuits, NDA blockers, and recent opportunity activity.",
      },
      {
        title: "Opportunity metrics page added",
        type: "feature",
        description: "Deal-flow KPIs now have their own analytics page, separated from repreneur pipeline analytics.",
      },
      {
        title: "Daily navigation reduced",
        type: "style",
        description: "Lower-frequency pages no longer crowd the sidebar, while remaining available by direct link for reference and troubleshooting.",
      },
      {
        title: "Navigation and access audit completed",
        type: "audit",
        description: "Staff and repreneur route separation was checked after the workspace split, including redirects, protected pages, and archived direct links.",
      },
    ],
  },
  {
    period: "May 17, 2026",
    version: "0.9.11",
    title: "Operational demo path and QA package",
    isCompleted: true,
    events: [
      {
        title: "Full opportunity journey assembled",
        type: "product",
        description: "The demo data now shows the full V2 chain: sourced opportunity, repreneur match, active pursuit, seller meeting stage, signed NDA, and approved teaser document.",
      },
      {
        title: "Deal-flow KPI panel verified",
        type: "feature",
        description: "Staff can now see active intermediaries, active opportunities, introductions, active pursuits, seller meetings, LOIs, dropped deals, closed deals, approved documents, and NDA blockers.",
      },
      {
        title: "Opportunity freshness reminders",
        type: "feature",
        description: "Opportunity list and detail pages show date/month added, and staff get a reminder when an open opportunity is older than 90 days with no active pursuit.",
      },
      {
        title: "Major end-to-end QA completed",
        type: "testing",
        description: "The product was tested across staff dashboard, opportunity list, opportunity detail, pursuit tab, documents tab, review page, redirects, and protected routes.",
      },
      {
        title: "Demo checklist prepared",
        type: "audit",
        description: "The launch package now lists what to show, what to verify before release, what to monitor after deploy, and which known limitations to state clearly.",
      },
      {
        title: "Release-readiness evidence collected",
        type: "audit",
        description: "Build results, browser checks, UAT records, demo data, and verification notes were gathered into one product handoff.",
      },
    ],
  },
  {
    period: "May 17, 2026",
    version: "0.9.10",
    title: "Validated deal execution workflow",
    isCompleted: true,
    events: [
      {
        title: "One active pursuit per opportunity",
        type: "feature",
        description: "Staff can validate only one active repreneur pursuit per opportunity. If that pursuit is dropped, the opportunity can be reopened for another path.",
      },
      {
        title: "Deal stage history added",
        type: "feature",
        description: "Validated pursuits can move through interest, intermediary meeting, seller meeting, LOI, closed, or dropped, with internal history for the team.",
      },
      {
        title: "NDA and document gate",
        type: "feature",
        description: "Staff can track NDA status and link documents. Repreneurs can download only the documents approved for them once the NDA state allows it.",
      },
      {
        title: "Review queue behavior hardened",
        type: "fix",
        description: "Role rules, response states, legacy deal links, and recommendation/review table behavior were tightened before closing the workflow.",
      },
      {
        title: "Deal workflow UAT passed",
        type: "testing",
        description: "The checks covered structured matching, staff review queue, portal privacy boundary, active-pursuit lock, stage tracking, document gate, and build health.",
      },
    ],
  },
  {
    period: "May 17, 2026",
    version: "0.9.9",
    title: "Repreneur portal and response loop",
    isCompleted: true,
    events: [
      {
        title: "External deal portal opened",
        type: "feature",
        description: "Repreneurs now have their own portal for deals and profile view, outside the internal staff dashboard shell.",
      },
      {
        title: "Profile summary made visible to repreneurs",
        type: "feature",
        description: "The portal profile shows WHO/WHEN scores, journey progress, strengths, improvement points, target thesis, and visible milestones.",
      },
      {
        title: "Realistic demo account prepared",
        type: "product",
        description: "A realistic demo repreneur profile was linked to portal credentials and populated with profile data, milestones, assessment data, and three visible opportunity matches.",
      },
      {
        title: "Interested / Not a fit actions",
        type: "feature",
        description: "Repreneurs can respond to proposed opportunities from the portal. Interest creates a staff review signal, not an automatic active pursuit.",
      },
      {
        title: "Staff review queue",
        type: "feature",
        description: "Responses now land in an internal review queue so the team can decide whether to validate a pursuit.",
      },
      {
        title: "Portal access cleanup added",
        type: "fix",
        description: "Repreneur credentials belong to actual repreneur records. If a repreneur is removed from the platform, their portal role and sessions are removed too.",
      },
    ],
  },
  {
    period: "May 16, 2026",
    version: "0.9.8",
    title: "Opportunity operating layer",
    isCompleted: true,
    events: [
      {
        title: "Opportunity records foundation",
        type: "feature",
        description: "The platform now has a structured place for sourced opportunities, status, source/contact metadata, staff-only fields, and repreneur-visible fields.",
      },
      {
        title: "Staff opportunity workspace",
        type: "feature",
        description: "Staff can list, create, edit, archive, and inspect opportunities from dedicated opportunity pages.",
      },
      {
        title: "Review-first import",
        type: "feature",
        description: "Workbook rows can be pasted or imported for review. The system shows warnings and blockers before any approved valid rows are saved.",
      },
      {
        title: "Private opportunity documents",
        type: "feature",
        description: "Opportunity documents are stored privately, with staff-controlled visibility for what a repreneur may later see.",
      },
      {
        title: "M&A source context added",
        type: "product",
        description: "Firm and contact details are captured for staff context without turning the June scope into a full M&A CRM.",
      },
      {
        title: "Opportunity field visibility separated",
        type: "audit",
        description: "Staff-only and repreneur-visible fields were split clearly so sensitive source and deal details stay on the right side of the product.",
      },
    ],
  },
  {
    period: "May 16, 2026",
    version: "0.9.7",
    title: "Deal-flow build foundation and QA protocol",
    isCompleted: true,
    events: [
      {
        title: "Opportunity workflow translated into build slices",
        type: "product",
        description: "The deal-flow product work was broken into opportunity records, matching, repreneur actions, pursuit tracking, document access, and reporting.",
      },
      {
        title: "Same-database test protocol",
        type: "testing",
        description: "Testing uses the current approved Supabase project to avoid extra cost, with additive migrations, marked UAT data, rollback notes, and cleanup before release.",
      },
      {
        title: "Release gates written before feature expansion",
        type: "testing",
        description: "The plan now includes backup, local testing, UAT, cleanup, push/merge, deploy checks, and monitoring responsibilities in plain language.",
      },
      {
        title: "Marked UAT data approach",
        type: "testing",
        description: "Test data is explicitly marked and cleaned up after validation, so product checks can use realistic records without polluting the live workflow.",
      },
    ],
  },
  {
    period: "May 9, 2026",
    version: "0.9.6",
    title: "CSV export: application_date split from first_contact_at",
    isCompleted: true,
    events: [
      {
        title: "Application and first contact are now two distinct columns",
        type: "feature",
        description: "Per Bertrand's KPI definitions: application_date = date the candidate submitted the intake form (the prior first_contact_at column was actually showing this). first_contact_at = date of the earliest team-logged activity for that repreneur (any activity type — interview, offer, welcome email log, meeting). Blank if no activity has been logged yet. Both YYYY-MM-DD.",
      },
      {
        title: "Unblocks Application → 1st Contact lag KPI",
        type: "fix",
        description: "Previous export collapsed both events into one date, so analysts couldn't measure the lag between submission and outreach. Both dates are now exported separately.",
      },
    ],
  },
  {
    period: "May 5, 2026",
    version: "0.9.5",
    title: "Funnel-analysis dates in CSV export",
    isCompleted: true,
    events: [
      {
        title: "Event dates added to repreneur export",
        type: "feature",
        description: "Find-page CSV now includes first_contact_at, first_interview_at, first_offer_at, second_offer_at, plus per-offer status, accepted_at and declined_at. All ISO YYYY-MM-DD so spreadsheets parse them as dates.",
      },
      {
        title: "Per-offer decline timestamp",
        type: "feature",
        description: "New repreneur_offers.declined_at column. Going forward, declining an offer stamps the precise rejection time on that offer (not just on the repreneur). Existing declined offers backfilled best-effort from repreneur.declined_at.",
      },
      {
        title: "Conversion-rate analysis unblocked",
        type: "fix",
        description: "Previous export only carried created_at plus a boolean — analysts couldn't tell when offers were sent, accepted, or rejected. Now they can.",
      },
    ],
  },
  {
    period: "Apr 23, 2026",
    version: "0.9.4",
    title: "V1 closeout — batch 2 (interview & assessment)",
    isCompleted: true,
    events: [
      {
        title: "Interview-booked filter on Groups",
        type: "feature",
        description: "New top filter [All / Interview booked / No interview] and a green calendar icon next to repreneurs who have an upcoming interview scheduled.",
      },
      {
        title: "Leadership assessment answers viewer",
        type: "feature",
        description: "New 'Answers' button on the Leadership Assessment card — opens a read-only view of all 26 question answers, same pattern as the WHO/WHEN pencil.",
      },
      {
        title: "24h pre-interview email reminder",
        type: "feature",
        description: "Automated email sent ~24h before a scheduled interview. Bertrand is BCC'd on every send. Placeholder French copy — he can edit lib/email/templates/interview-reminder.tsx directly.",
      },
    ],
  },
  {
    period: "Apr 23, 2026",
    version: "0.9.3",
    title: "V1 closeout — Bertrand backlog pass",
    isCompleted: true,
    events: [
      {
        title: "Qualified now means 'offer pending'",
        type: "direction",
        description: "Assigning an offer moves a repreneur to Qualified. Offer accepted → Client, offer rejected → Declined. Matches how Bertrand thinks about the pipeline.",
      },
      {
        title: "Offer-rejected bug fixed",
        type: "fix",
        description: "Logging an 'Offer rejected' activity now correctly flips the offer status to Declined (it used to stay Pending).",
      },
      {
        title: "Updated application questionnaire",
        type: "feature",
        description: "New first question on career priority (-10 if acquisition is 'one option among others'). Equity '<150 K€' replaces the vague 'To be evaluated'. Claiming a framed project without a fiche de cadrage now costs -10. Old records keep their original scores.",
      },
      {
        title: "Current needs visible on profile",
        type: "fix",
        description: "Q18 'besoins actuels' was captured by the form but never shown. Now rendered in the Investment Profile card.",
      },
      {
        title: "Decline reasons chart on analytics",
        type: "feature",
        description: "New bar chart shows why repreneurs decline offers — pricing, timing, competitor, etc. Feeds directly into conversion analysis.",
      },
    ],
  },
  {
    period: "Feb 12, 2026",
    version: "0.9.2",
    title: "Login Security & Waitlist System",
    isCompleted: true,
    events: [
      {
        title: "Secure login page",
        type: "feature",
        description: "Removed quick-access buttons. Login now requires real credentials only.",
      },
      {
        title: "Request Access waitlist",
        type: "feature",
        description: "New form for repreneurs and sellers to request platform access. Entries stored for review.",
      },
      {
        title: "Role selection at signup",
        type: "feature",
        description: "Users choose Repreneur or Seller when requesting access, so we know who's knocking.",
      },
      {
        title: "Notes and activities bug fixed",
        type: "fix",
        description: "Notes no longer disappear after saving. Data persists correctly on all profiles.",
      },
    ],
  },
  {
    period: "Feb 4, 2026",
    version: "0.9.1",
    title: "Dashboard Fix & Performance Optimization",
    isCompleted: true,
    events: [
      {
        title: "Dashboard crash fixed",
        type: "fix",
        description: "Dashboard no longer crashes when a repreneur has 'Declined' status. The page now loads reliably for all profiles.",
      },
      {
        title: "App loads faster (~250KB lighter)",
        type: "feature",
        description: "Removed unused libraries and enabled automatic image compression. Pages load faster, especially on mobile.",
      },
      {
        title: "Public form ready for real users",
        type: "feature",
        description: "Test/autofill buttons removed from the intake form. The form is now clean and ready for external repreneurs.",
      },
    ],
  },
  {
    period: "Feb 2, 2026",
    version: "0.9.0",
    title: "AI Email Generator & Pipeline Improvements",
    isCompleted: true,
    events: [
      {
        title: "AI-powered email generator",
        type: "feature",
        description: "Wavy can now draft personalized emails for any repreneur. Select candidate, pick template, generate. Try it from /emails.",
      },
      {
        title: "Leads auto-sort by potential",
        type: "feature",
        description: "Pipeline Leads column now ranks by Tier 1 score — best candidates always on top.",
      },
      {
        title: "Declined vs Rejected distinction",
        type: "feature",
        description: "New 'Declined' status for internal qualification calls, separate from rejection emails sent to candidates.",
      },
      {
        title: "Declined column on pipeline",
        type: "feature",
        description: "New gray column on pipeline board between Client and Rejected.",
      },
      {
        title: "Profile data display fixes",
        type: "fix",
        description: "Investment Profile, T1 Skills radar, and WHEN editor now correctly show data from the new questionnaire.",
      },
      {
        title: "Navigation cleanup",
        type: "fix",
        description: "Dead routes removed, no more 404 errors in menu.",
      },
    ],
  },
  {
    period: "Jan 25, 2026",
    version: "0.8.9",
    title: "Questionnaire V2 & Flatchr Import",
    isCompleted: true,
    events: [
      {
        title: "New questionnaire live",
        type: "feature",
        description: "Complete intake form now at /intake-v2. Quick link in the sidebar for easy access.",
      },
      {
        title: "Scoring system updated",
        type: "feature",
        description: "Tier 1 rating now 200 points total — 100 for WHO (profile), 100 for WHEN (project readiness).",
      },
      {
        title: "Flags and recommendations automated",
        type: "feature",
        description: "System now flags concerns and suggests next steps (Deal Flow, Priority Interview) based on the scoring matrix.",
      },
      {
        title: "All Flatchr candidates imported",
        type: "feature",
        description: "Everyone from the Flatchr export is now in Wave. Historical data preserved.",
      },
      {
        title: "Multilingual form",
        type: "feature",
        description: "Intake form now available in French and English. Language toggle at the top.",
      },
    ],
  },
  {
    period: "Jan 25, 2026",
    version: "0.8.8",
    title: "Simplified Profile Editing",
    isCompleted: true,
    events: [
      {
        title: "Create test repreneur in 1 click",
        type: "feature",
        description: "New 'Intake (v2)' link in the sidebar. No more typing URLs manually.",
      },
      {
        title: "Edit answers directly on profile",
        type: "feature",
        description: "WHO/WHEN questions now editable right on the repreneur page. Scores update in real-time when you save.",
      },
      {
        title: "'Needs completion' badge clears automatically",
        type: "fix",
        description: "Once you fill in the new questionnaire for a legacy repreneur, the orange alert disappears.",
      },
      {
        title: "Old questionnaire locked",
        type: "refactor",
        description: "Historical answers preserved but not editable. All edits happen through the new unified form.",
      },
    ],
  },
  {
    period: "Jan 20, 2026",
    version: "0.8.7",
    title: "Antoine's Feedback Fixes",
    isCompleted: true,
    events: [
      {
        title: "Offer assignment bug fix",
        type: "fix",
        description: "Fixed 'appear then disappear' bug. Root cause: FK constraint on created_by referenced auth.users (Supabase Auth) but we use Better Auth. Fixed by dropping constraint and changing column from UUID to TEXT.",
      },
      {
        title: "Target region multi-select",
        type: "feature",
        description: "Repreneurs can now select multiple target regions instead of just one. Uses checkbox grid (same as sector preferences). Database column migrated from TEXT to JSONB array.",
      },
      {
        title: "Optimistic UI pattern",
        type: "feature",
        description: "Offer list now uses optimistic updates with local state buffer and mutation guard. Changes appear immediately while server confirms in background.",
      },
    ],
  },
  {
    period: "Jan 18, 2026",
    version: "0.8.5",
    title: "Auth Signup & Production Fixes",
    isCompleted: true,
    events: [
      {
        title: "Signup functionality",
        type: "feature",
        description: "Added signup option to login page. Toggle between Sign In and Sign Up modes. New users can create accounts with name, email, and password.",
      },
      {
        title: "Production cookie fix",
        type: "fix",
        description: "Fixed middleware to handle __Secure- cookie prefix in production. Login now works correctly on deployed Vercel instance.",
      },
      {
        title: "ICP Team email corrected",
        type: "fix",
        description: "Fixed ICP Team quick access button to use correct email (renew@icpteam.eu) instead of placeholder.",
      },
      {
        title: "Database schema for Better Auth",
        type: "direction",
        description: "Created camelCase tables (user, session, account, verification) matching Better Auth's expected schema. Deployed via Supabase SQL Editor.",
      },
    ],
  },
  {
    period: "Jan 18, 2026",
    version: "0.8.4",
    title: "Task Management UI Improvements",
    isCompleted: true,
    events: [
      {
        title: "Kanban board view",
        type: "feature",
        description: "New board view showing tasks in columns by status: To Do, In Progress, Blocked, Done. Quick status updates with click actions.",
      },
      {
        title: "View switcher",
        type: "feature",
        description: "Toggle between List view (grouped by stream) and Board view (grouped by status). Remembers preference during session.",
      },
      {
        title: "Compact task cards",
        type: "style",
        description: "Reduced vertical whitespace in task list. Smaller padding, tighter spacing, more tasks visible on screen.",
      },
      {
        title: "Edit form sync fix",
        type: "fix",
        description: "Task edit form now properly populates when clicking edit. Title and status now match the selected task.",
      },
    ],
  },
  {
    period: "Jan 17, 2026",
    version: "0.8.3",
    title: "Better Auth Migration",
    isCompleted: true,
    events: [
      {
        title: "Switched to Better Auth",
        type: "direction",
        description: "Migrated from Supabase Auth to Better Auth, a TypeScript-first, self-hosted authentication library. Gives full control over auth without Supabase lock-in.",
      },
      {
        title: "New auth middleware",
        type: "feature",
        description: "Created Next.js middleware for route protection. Automatically redirects unauthenticated users to login. Handles protected routes and session management.",
      },
      {
        title: "Email/password auth preserved",
        type: "feature",
        description: "Same login flow: email + password. Users sign in with their individual credentials.",
      },
      {
        title: "User creation API",
        type: "feature",
        description: "New /api/auth/create-users endpoint to seed initial users. Protected by admin secret in production.",
      },
      {
        title: "Tasks: Better Auth compatibility",
        type: "fix",
        description: "Updated task actions to use admin client (bypasses RLS). Auth verified at app layer via requireUser(). Removed FK-dependent fields.",
      },
    ],
  },
  {
    period: "Jan 17, 2026",
    version: "0.8.2",
    title: "Task Management for V1.0 Launch",
    isCompleted: true,
    events: [
      {
        title: "Tasks page with CRUD",
        type: "feature",
        description: "New /tasks page for tracking V1.0 launch activities. Create, edit, delete tasks with full form. Filter by stream, status, and owner.",
      },
      {
        title: "Stream-based organization",
        type: "feature",
        description: "Tasks grouped by work stream: Questionnaire, Emails, Branding, Testing, Go-Live. Progress bars per stream. Stats badges for completion tracking.",
      },
      {
        title: "Dependencies & blocking",
        type: "feature",
        description: "Tasks can depend on other tasks. Visual indicators show when a task is blocked by incomplete dependencies. Delay calculation from expected dates.",
      },
      {
        title: "Owner assignment",
        type: "feature",
        description: "Assign tasks to team members (Bertrand, Amélie, Antoine, Ivan). Filter views by owner. Track who's responsible for what.",
      },
      {
        title: "Dogfooding approach",
        type: "direction",
        description: "Using the platform itself to track V1.0 launch tasks. Tests authentication and email systems while managing the project.",
      },
    ],
  },
  {
    period: "Jan 17, 2026",
    version: "0.8.1",
    title: "Security Audit & Codebase Cleanup",
    isCompleted: true,
    events: [
      {
        title: "10 security issues fixed",
        type: "fix",
        description: "SQL injection protection, API auth checks, webhook signature enforcement, file upload validation (magic bytes), atomic DB operations, race condition fixes.",
      },
      {
        title: "Dead code removed",
        type: "refactor",
        description: "Removed ~1,665 lines: 4 unused dashboard versions, development/test pages, unused components. Cleaner codebase, faster builds.",
      },
      {
        title: "Database performance indexes",
        type: "feature",
        description: "Added 6 indexes for activities, notes, email_logs, and repreneurs tables. Queries will stay fast as data grows.",
      },
      {
        title: "Type safety improvements",
        type: "fix",
        description: "Fixed email template types, function signatures, and metadata structures. Better TypeScript strictness.",
      },
    ],
  },
  {
    period: "Jan 11, 2026",
    version: "0.8.0",
    title: "Structured Readiness Journey",
    isCompleted: true,
    events: [
      {
        title: "11 Readiness Milestones",
        type: "feature",
        description: "New Tier 3 milestone system with 11 checkboxes tracking acquisition readiness. Grouped by stage transitions: Explorer→Learner (3), Learner→Ready (4), Ready→Serial (4 incl. First Acquisition).",
      },
      {
        title: "Journey stage auto-derivation",
        type: "feature",
        description: "Journey stage now computed from milestone count instead of manual selection. Explorer (0-2), Learner (3-6), Ready (7-10), Serial Acquirer (11 milestones).",
      },
      {
        title: "Tier 2 competency dimensions",
        type: "feature",
        description: "6-dimension rating system replacing single star: Leadership, Financial Acumen, Communication, Clarity of Vision, Coachability, Commitment. Weighted average with 4.0 pass threshold.",
      },
      {
        title: "Profile header redesign",
        type: "style",
        description: "Status and Journey badges moved to top-right with labels. Milestones in compact 2-column layout below radar chart. Responsive mobile layout.",
      },
      {
        title: "Journey page milestone display",
        type: "feature",
        description: "Stage pipeline boxes now show milestone names instead of counts. Clear visibility into what's needed for each stage transition.",
      },
      {
        title: "Milestone-based progression",
        type: "direction",
        description: "Removed persona requirement for Serial Acquirer. Stage progression now purely based on completing milestones. 'First acquisition completed' is the key milestone for Serial status.",
      },
    ],
  },
  {
    period: "Jan 11, 2026",
    version: "0.7.5",
    title: "List View & Data Quality",
    isCompleted: true,
    events: [
      {
        title: "Repreneurs list UX overhaul",
        type: "feature",
        description: "Grouped view with per-group pagination (8 items/page). Independent column sorting per status group. Empty groups auto-collapse on load. Consistent visual layout.",
      },
      {
        title: "Fixed table column widths",
        type: "fix",
        description: "Long emails no longer push columns causing inconsistent widths between groups. Table uses fixed layout with truncation and ellipsis for overflow text.",
      },
      {
        title: "Avatar upload bug fixes",
        type: "fix",
        description: "Fixed server action rendering errors by moving to API routes. Added cache revalidation so avatar changes appear immediately in table views. Created migration for missing column.",
      },
      {
        title: "Journey progress badges",
        type: "feature",
        description: "Milestone count badges (X/11) now shown next to repreneur names on Journey page stage cards. Quick visibility into who needs attention.",
      },
      {
        title: "Flatchr data import",
        type: "feature",
        description: "SQL script for importing 93 historical repreneurs from Flatchr export. Includes tier1_score_breakdown field for imported records. One-time migration tool.",
      },
      {
        title: "Terminology standardization",
        type: "refactor",
        description: "Replaced 'candidate' with 'repreneur' throughout codebase and tests. Consistent language matching Re-New's terminology for acquisition entrepreneurs.",
      },
    ],
  },
  {
    period: "Jan 10-11, 2026",
    version: "0.7.0",
    title: "Tier 1 Rating Improvements",
    isCompleted: true,
    events: [
      {
        title: "Compact inline editor on profile",
        type: "feature",
        description: "All 15 Tier 1 questions now editable directly on profile page. Collapsible panel with dropdowns, multi-selects (with search), and toggles. Auto-recalculates score on change.",
      },
      {
        title: "LDC upload in intake form",
        type: "feature",
        description: "Lettre de Cadrage upload added to Step 4 (Goals) of public intake form. Amber-styled section with optional skip. Stored alongside CV.",
      },
      {
        title: "Scoring algorithm fix",
        type: "fix",
        description: "Fixed critical bug where scoring algorithm ignored database criteria. Admin edits in /guide/evaluation now properly affect new intake scores. Uses DB values with hardcoded fallback.",
      },
      {
        title: "In-place editing over wizard",
        type: "direction",
        description: "Replaced full-page questionnaire wizard for profile edits with compact inline editor. Faster for quick corrections while preserving step-by-step wizard for public intake.",
      },
    ],
  },
  {
    period: "Jan 10, 2026",
    version: "0.6.8",
    title: "Email System Live",
    isCompleted: true,
    events: [
      {
        title: "Resend integration configured",
        type: "feature",
        description: "Connected Resend API with verified domain notifications@renew-wave.com. Production email sending now operational.",
      },
      {
        title: "Founder notification emails",
        type: "feature",
        description: "Sent Welcome and High Score test emails to all 3 founders (Bertrand, Amelie, Antoine) to announce platform is live.",
      },
      {
        title: "Sandbox warning removed",
        type: "fix",
        description: "Removed development sandbox warning from Email Cockpit UI now that production email is configured.",
      },
    ],
  },
  {
    period: "Jan 10, 2026",
    version: "0.6.6",
    title: "Documents Management",
    isCompleted: true,
    events: [
      {
        title: "CV upload in intake form",
        type: "feature",
        description: "Repreneurs can now upload their CV (PDF only) during the intake questionnaire. Stored in Supabase Storage with 10MB limit.",
      },
      {
        title: "Documents card on profile",
        type: "feature",
        description: "New Documents card managing CV and Lettre de Cadrage uploads. View, upload, replace, and delete functionality with consistent UI.",
      },
      {
        title: "Lettre de Cadrage storage",
        type: "feature",
        description: "Added LDC document field for storing framing letters. Internal document, not included in public intake form.",
      },
      {
        title: "PDF-only for intake",
        type: "direction",
        description: "Intake form restricted to PDF uploads only for consistency. Profile page accepts both PDF and Word for flexibility.",
      },
      {
        title: "Avatar storage bucket setup",
        type: "fix",
        description: "Created avatars storage bucket with RLS policies. Custom photo uploads now work. Deterministic defaults (1 of 16 faces) shown when no custom photo.",
      },
    ],
  },
  {
    period: "Jan 10, 2026",
    version: "0.6.5",
    title: "Client Offers Timeline",
    isCompleted: true,
    events: [
      {
        title: "Offers page redesigned",
        type: "feature",
        description: "Transformed from package list to client offer timeline. Main view now shows all offers assigned to clients with visual progress tracking.",
      },
      {
        title: "Timeline progress indicator",
        type: "feature",
        description: "Visual status flow: Offered → Active → Completed. Each card shows client avatar, package, key dates, and milestone completion counts.",
      },
      {
        title: "Package management sheet",
        type: "feature",
        description: "Moved package CRUD to side panel ('Manage Packages' button). Packages are created rarely; daily use is tracking client progress.",
      },
      {
        title: "Search and filter",
        type: "feature",
        description: "Search by client name, email, or package. Filter by status (Active, Pending, Completed, Expired). Grouped display by status.",
      },
      {
        title: "Daily use case focus",
        type: "direction",
        description: "Recognized that packages are created rarely (3 exist). The daily use case is tracking offer progress with clients, not managing packages. UI reorganized accordingly.",
      },
    ],
  },
  {
    period: "Jan 10, 2026",
    version: "0.6.0",
    title: "Evaluation Criteria Visibility",
    isCompleted: true,
    events: [
      {
        title: "Evaluation Criteria page",
        type: "feature",
        description: "New Guide page showing all Tier 1 scoring questions, answers, and point values. Makes previously hard-coded scoring logic visible to dashboard users.",
      },
      {
        title: "Inline criteria editing",
        type: "feature",
        description: "Edit question labels, answer labels, and scores directly from the page. Changes only affect future candidates (existing scores frozen).",
      },
      {
        title: "Database-driven criteria",
        type: "refactor",
        description: "Scoring criteria moved from hard-coded TypeScript to database table. Foundation for future Tier 2 and Tier 3 evaluation systems.",
      },
      {
        title: "Frozen scores",
        type: "direction",
        description: "When criteria change, existing repreneur scores remain unchanged. Only new questionnaire completions use updated criteria. Preserves historical integrity.",
      },
    ],
  },
  {
    period: "Jan 4, 2026 (PM)",
    version: "0.5.5",
    title: "Email System Hardening",
    isCompleted: true,
    events: [
      {
        title: "Email error handling fixed",
        type: "fix",
        description: "Manual email send now properly checks Resend API response. UI displays actual errors instead of false success messages. Prevents silent failures.",
      },
      {
        title: "To Do guide page",
        type: "feature",
        description: "New guide page listing pending items for founders: domain verification, environment variables, Flatchr import, team onboarding. Actionable steps with external links.",
      },
      {
        title: "Test repreneur script",
        type: "feature",
        description: "Utility script to add test repreneur with Resend-verified email. Enables email testing while in sandbox mode.",
      },
      {
        title: "Learning: Resend sandbox mode",
        type: "learning",
        description: "Resend sandbox (onboarding@resend.dev) can only send to account owner email. Production requires verified domain. Added to To Do with step-by-step instructions.",
      },
    ],
  },
  {
    period: "Jan 4, 2026",
    version: "0.5.4",
    title: "Production Ready",
    isCompleted: true,
    events: [
      {
        title: "Wave Guide documentation system",
        type: "feature",
        description: "Created comprehensive in-app documentation with Mission, Instructions, and Roadmap pages. Team can onboard and reference platform guidelines without external docs.",
      },
      {
        title: "Email automation with Resend",
        type: "feature",
        description: "10 automated email templates: welcome, form step completions, high-score alerts, offer notifications, milestone celebrations. Manual send capability for testing.",
      },
      {
        title: "Learning: Next.js error sanitization",
        type: "learning",
        description: "Discovered production builds sanitize thrown errors from Server Actions. Switched to returning result objects { success, message } for proper error display.",
      },
      {
        title: "E2E test suite expanded",
        type: "feature",
        description: "67 automated tests across 10 suites covering Emails, Guide, Dashboard, Pipeline, and core CRUD operations. Test-driven confidence for future changes.",
      },
      {
        title: "Learnings module (external users)",
        type: "feature",
        description: "Swipeable course selector with lesson tracking. Dynamic theming per course. Foundation for repreneur self-service education content.",
      },
      {
        title: "Questionnaire form consolidation",
        type: "refactor",
        description: "Eliminated ~1800 lines of duplicated code. Public intake and internal questionnaire now share components and question definitions.",
      },
    ],
  },
  {
    period: "Jan 4, 2026 (AM)",
    version: "0.5.2",
    title: "Critical Infrastructure Fix",
    isCompleted: true,
    events: [
      {
        title: "Project structure flattened",
        type: "fix",
        description: "V0 export created broken nested app/app/ structure. Vercel builds failed, path aliases broke. 4-hour emergency restructure to standard Next.js layout.",
      },
      {
        title: "Learning: V0 export structure",
        type: "learning",
        description: "V0 exports with nested project structure that doesn't match standard Next.js. Future V0 projects need immediate restructuring before development continues.",
      },
      {
        title: "iCloud sync conflicts cleaned",
        type: "fix",
        description: "Removed 164 duplicate files from iCloud sync conflicts (*.* 2, *.* 3 suffixes). ~1GB of duplicate node_modules recovered.",
      },
      {
        title: "Email templates translated to English",
        type: "style",
        description: "All 10 email templates converted from French to English. Date formatting switched from fr-FR to en-US locale.",
      },
    ],
  },
  {
    period: "Jan 3, 2026",
    version: "0.5.0",
    title: "Wave Dashboard",
    isCompleted: true,
    events: [
      {
        title: "Dashboard complete redesign",
        type: "feature",
        description: "New 3-column layout with 12+ widgets. Wave branding with animated emoji logo. Activity stream, rankings, and conversion funnel all visible at once.",
      },
      {
        title: "Activity heatmap",
        type: "feature",
        description: "GitHub-style 12-month heatmap showing daily activity (new repreneurs + logged activities). Visual proof of team engagement over time.",
      },
      {
        title: "Streaming architecture",
        type: "direction",
        description: "Dashboard loads in 3 independent streaming sections. Parallel data fetches + 30-second cache. Page feels fast even with heavy data.",
      },
      {
        title: "Conversion funnel visualization",
        type: "feature",
        description: "Lead → Qualified → Client funnel with live conversion rates. Journey stage pie chart. Week-over-week comparisons for growth tracking.",
      },
      {
        title: "Notion-style avatars",
        type: "style",
        description: "Replaced gradient avatars with 24 Notion face illustrations. Deterministic assignment by repreneur ID. Cohesive, friendly visual language.",
      },
    ],
  },
  {
    period: "Jan 2, 2026",
    version: "0.4.5",
    title: "V1.0 Enhancements",
    isCompleted: true,
    events: [
      {
        title: "Offer milestones system",
        type: "feature",
        description: "Track deliverables and checkpoints per client. Milestones grouped by type with completion tracking. Visibility into engagement progress.",
      },
      {
        title: "Persona categorization",
        type: "feature",
        description: "Buyer types: First-time, Serial acquirer, Corporate spin-off, Family succession. Helps tailor communication and offer recommendations.",
      },
      {
        title: "Notes system redesign",
        type: "feature",
        description: "Note types (call, email, meeting, other) with icons and colors. Full-content view dialogs. Activity history enhanced with same pattern.",
      },
      {
        title: "Radar chart fixes",
        type: "fix",
        description: "Fixed scale to show actual max (~98 pts). Raw scores in tooltips. Clear dimension descriptions showing questionnaire sources.",
      },
      {
        title: "Form dropdowns replace free text",
        type: "feature",
        description: "Investment Capacity, Target Size, Target Location (French regions), Sector Preferences (multi-select). Structured data enables better filtering and analytics.",
      },
    ],
  },
  {
    period: "Jan 1, 2026",
    version: "0.4.0",
    title: "UX Polish Sprint",
    isCompleted: true,
    events: [
      {
        title: "Skeleton loading states",
        type: "feature",
        description: "Custom loading skeletons matching actual page layouts. Perceived performance boost. No more layout shift on page loads.",
      },
      {
        title: "Page transition animations",
        type: "feature",
        description: "Framer Motion fade/slide between routes. Animated sidebar active indicator. App feels polished and responsive.",
      },
      {
        title: "Toast notification system",
        type: "feature",
        description: "Sonner library integration. Success/error feedback for all CRUD operations. Non-intrusive bottom-right positioning.",
      },
      {
        title: "Optimistic UI updates",
        type: "feature",
        description: "useOptimistic hook for instant inline edits. UI updates immediately, syncs with server in background. Automatic rollback on errors.",
      },
      {
        title: "Tier 1 radar chart",
        type: "feature",
        description: "Spider chart visualizing 5 scoring dimensions: Experience, Leadership, M&A Knowledge, Readiness, Financial. Instant candidate assessment.",
      },
    ],
  },
  {
    period: "Dec 31, 2025",
    version: "0.3.8",
    title: "Bug Fixing Day",
    isCompleted: true,
    events: [
      {
        title: "Notes disappearing bug",
        type: "fix",
        description: "Notes vanished after optimistic updates due to state clearing before save. Fixed by preserving content until server confirms.",
      },
      {
        title: "React hydration warnings",
        type: "fix",
        description: "Added suppressHydrationWarning for timestamp differences between server and client rendering.",
      },
      {
        title: "EditableSelectField crash",
        type: "fix",
        description: "Radix UI Select doesn't allow empty strings. Changed 'Clear' option to special constant '__CLEAR__' converted to null on save.",
      },
      {
        title: "Learning: Optimistic update edge cases",
        type: "learning",
        description: "Optimistic UI needs careful state management. Always preserve original data until server confirms. Plan rollback paths upfront.",
      },
    ],
  },
  {
    period: "Dec 30, 2025",
    version: "0.3.5",
    title: "Core Feature Sprint",
    isCompleted: true,
    events: [
      {
        title: "Action-driven status",
        type: "direction",
        description: "No manual drag-drop status changes. Status is derived from actions (set Tier 2 → Qualified, assign offer → Client), preventing inconsistent data.",
      },
      {
        title: "Two-tier scoring system",
        type: "feature",
        description: "Tier 1: Automated score from 15 questionnaire questions with category breakdown. Tier 2: Manual 1-5 stars post-interview. Separates data from judgment.",
      },
      {
        title: "Full questionnaire system",
        type: "feature",
        description: "15 structured questions covering Experience, Leadership, M&A Knowledge, Readiness, Financials. Auto-scoring with detailed breakdowns.",
      },
      {
        title: "Avatar system with uploads",
        type: "feature",
        description: "24 default illustrations with deterministic assignment. Custom photo upload via Supabase Storage. Multiple size variants for different contexts.",
      },
      {
        title: "Notes with author tracking",
        type: "feature",
        description: "Free-text notes with timestamp and author. Chronological display. Foundation for team communication history.",
      },
      {
        title: "Inline editing components",
        type: "feature",
        description: "EditableTextField, EditableSelectField, EditableMultiSelectField. Click-to-edit pattern with keyboard shortcuts (Enter to save, Escape to cancel).",
      },
    ],
  },
  {
    period: "Dec 29, 2025",
    version: "0.3.0",
    title: "Platform Foundation",
    isCompleted: true,
    events: [
      {
        title: "Repository initialized",
        type: "feature",
        description: "Exported from V0, connected to GitHub, deployed to Vercel. First working version accessible via URL.",
      },
      {
        title: "Journey stage concept",
        type: "feature",
        description: "Repreneur maturity tracking: Explorer → Learner → Ready → Serial Acquirer. Independent from pipeline status. Tracks acquisition readiness.",
      },
      {
        title: "Offer management CRUD",
        type: "feature",
        description: "Create, edit, delete offers. Assignment to repreneurs with status workflow (offered → active → completed/expired). Auto-expiration dates.",
      },
      {
        title: "Pipeline views",
        type: "feature",
        description: "Kanban board with filters (name, source, date range). List view with status grouping and collapsible sections. 'Show more' for large datasets.",
      },
      {
        title: "Test data seeding",
        type: "feature",
        description: "API endpoint for populating dev environment. 10 test repreneurs, 4 offers, sample notes. Essential for development and demos.",
      },
      {
        title: "Detail page with inline editing",
        type: "feature",
        description: "Full repreneur profile with click-to-edit fields. Status badge, journey stage dropdown, back button navigation.",
      },
    ],
  },
  {
    period: "Dec 27-28, 2025",
    version: "0.2.5",
    title: "V0 Foundation",
    isCompleted: true,
    events: [
      {
        title: "Next.js + Supabase setup",
        type: "feature",
        description: "Project scaffolded in V0. Supabase client configuration, environment variables, Vercel deployment pipeline established.",
      },
      {
        title: "Authentication system",
        type: "feature",
        description: "Email/password auth with Supabase for 3 team members. Login page, protected routes, session persistence. Users created manually.",
      },
      {
        title: "Database schema design",
        type: "feature",
        description: "Repreneur, Offer, Note, Activity tables with foreign keys. Row Level Security policies. Migration scripts for iterative changes.",
      },
      {
        title: "Repreneur list view",
        type: "feature",
        description: "Sortable, filterable table. Clickable rows navigating to detail page. Source tags, status badges, contact info display.",
      },
      {
        title: "shadcn/ui component library",
        type: "feature",
        description: "Installed Card, Button, Badge, Dialog, Select, Dropdown, Sheet, and more. Consistent design system from day one.",
      },
    ],
  },
  {
    period: "Dec 22-26, 2025",
    version: "0.2.0",
    title: "Architecture Planning",
    isCompleted: true,
    events: [
      {
        title: "V0 for rapid prototyping",
        type: "direction",
        description: "Chose to start in V0.dev for AI-assisted UI generation, then export to local for advanced features. Speed over full control initially.",
      },
      {
        title: "Supabase over custom backend",
        type: "direction",
        description: "PostgreSQL + instant APIs + auth + storage in one platform. No separate backend needed. Team can manage DB through dashboard.",
      },
      {
        title: "Database schema finalized",
        type: "feature",
        description: "Defined Repreneur lifecycle, Offer structure, Note/Activity tracking. Considered Flatchr fields for migration compatibility.",
      },
      {
        title: "No drag-drop Kanban",
        type: "direction",
        description: "Rejected manual status changes via drag-drop. Status changes must be triggered by meaningful actions. Prevents 'status without substance' problem.",
      },
      {
        title: "TaskMaster setup",
        type: "feature",
        description: "Configured task tracking with MCP integration. PRD parsed into 50+ actionable tasks with dependencies. Progress visible in tasks.json.",
      },
    ],
  },
  {
    period: "Dec 18-21, 2025",
    version: "0.1.5",
    title: "Requirements & Strategy",
    isCompleted: true,
    events: [
      {
        title: "PRD completed",
        type: "feature",
        description: "6-page product requirements document covering authentication, data model, scoring, offers, activities, and UI requirements.",
      },
      {
        title: "Learning: CRM vs ATS mindset",
        type: "learning",
        description: "Flatchr treated repreneurs as one-time candidates. Wave must treat them as long-term relationships. This shapes every product feature.",
      },
      {
        title: "Timeline scoped: 8-10 FTE days",
        type: "direction",
        description: "Aggressive but achievable timeline. Prioritized core pipeline over nice-to-haves. Deferred Flatchr import, advanced analytics, client portal.",
      },
      {
        title: "Tech stack confirmed",
        type: "direction",
        description: "Next.js 16 + Tailwind + shadcn/ui for frontend. Supabase for backend. Vercel for hosting. Modern, maintainable, well-documented.",
      },
    ],
  },
  {
    period: "Dec 15-17, 2025",
    version: "0.1.0",
    title: "Project Inception",
    isCompleted: true,
    events: [
      {
        title: "Problem identified: Flatchr limitations",
        type: "direction",
        description: "Current ATS designed for recruitment, not relationship management. Once candidate 'placed', the system forgets them. Repreneurs need ongoing support.",
      },
      {
        title: "Vision: Purpose-built repreneur CRM",
        type: "direction",
        description: "Single profile per repreneur tracking entire journey. Multiple offers over time. Activity history. Cost analytics eventually. Built for Re-New's specific workflow.",
      },
      {
        title: "Stakeholder alignment",
        type: "direction",
        description: "Bertrand (CEO) + 2 part-time team members as users. Simple access model: 3 equal users, no role hierarchy. Focus on usability over enterprise features.",
      },
      {
        title: "Build custom vs buy",
        type: "direction",
        description: "Evaluated off-the-shelf CRMs. None matched repreneur journey model with integrated scoring and offer tracking. Custom build justified by unique requirements.",
      },
    ],
  },
]

const typeConfig: Record<RoadmapEventType, { icon: LucideIcon; color: string; bgColor: string; label: string }> = {
  feature: { icon: Sparkles, color: "text-blue-600", bgColor: "bg-blue-50", label: "Feature" },
  product: { icon: Zap, color: "text-sky-600", bgColor: "bg-sky-50", label: "Product work" },
  fix: { icon: Bug, color: "text-green-600", bgColor: "bg-green-50", label: "Fix" },
  style: { icon: Palette, color: "text-primary", bgColor: "bg-accent", label: "UX improvement" },
  testing: { icon: AlertTriangle, color: "text-indigo-600", bgColor: "bg-indigo-50", label: "Testing" },
  audit: { icon: CheckCircle, color: "text-emerald-600", bgColor: "bg-emerald-50", label: "Audit" },
  refactor: { icon: RefreshCw, color: "text-amber-600", bgColor: "bg-amber-50", label: "Refactor" },
  direction: { icon: Target, color: "text-rose-600", bgColor: "bg-rose-50", label: "Product direction" },
  learning: { icon: Lightbulb, color: "text-yellow-600", bgColor: "bg-yellow-50", label: "Learning" },
  decision: { icon: CheckCircle, color: "text-primary", bgColor: "bg-accent", label: "Decision" },
}

export function DevelopmentRoadmap() {
  // Calculate stats
  const totalEvents = roadmapEvents.reduce((acc, period) => acc + period.events.length, 0)
  const productWork = roadmapEvents.reduce((acc, period) =>
    acc + period.events.filter(e => e.type === "product").length, 0)
  const uxImprovements = roadmapEvents.reduce((acc, period) =>
    acc + period.events.filter(e => e.type === "style").length, 0)
  const validationWork = roadmapEvents.reduce((acc, period) =>
    acc + period.events.filter(e => e.type === "testing" || e.type === "audit").length, 0)
  const features = roadmapEvents.reduce((acc, period) =>
    acc + period.events.filter(e => e.type === "feature").length, 0)
  const fixes = roadmapEvents.reduce((acc, period) =>
    acc + period.events.filter(e => e.type === "fix").length, 0)
  const productUpdates = features + productWork + fixes

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Development Roadmap</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The complete journey of Wave — from first idea to production
        </p>
      </div>

      {/* Stats summary */}
      <WaveSegmentedSummary>
        {[
          [roadmapEvents.length, "Milestones"],
          [productUpdates, "Product updates"],
          [uxImprovements, "UX improvements"],
          [validationWork, "QA / audits"],
        ].map(([value, label]) => (
          <WaveSegmentedMetric key={label} value={value} label={label} />
        ))}
      </WaveSegmentedSummary>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-blue-200" />

        {roadmapEvents.map((period, index) => (
          <div
            key={index}
            className="relative pb-8 pl-10 last:pb-0"
          >
            {/* Timeline dot */}
            <div className="absolute left-0 size-6 rounded-full bg-blue-500 border-4 border-white shadow-sm" />

            {/* Period card */}
            <Card className="overflow-hidden border-blue-100 py-0 gap-0">
              <CardContent className="p-0">
                <div className="wave-panel-muted flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs bg-white">
                        <Calendar className="size-3 mr-1" />
                        {period.period}
                      </Badge>
                      {period.isCompleted && (
                        <CheckCircle className="size-4 text-green-500" />
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {period.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {period.events.length} updates
                      {period.version && (
                        <span className="ml-2 text-[10px] font-mono text-muted-foreground">v{period.version}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="px-3 pb-3 pt-2 border-t border-blue-100 space-y-2">
                  {period.events.map((event, i) => {
                    const config = typeConfig[event.type]
                    const Icon = config.icon
                    return (
                      <div
                        key={i}
                        className="flex gap-2.5 rounded-lg bg-muted/40 px-2.5 py-2 transition-colors hover:bg-muted"
                      >
                        <div className={`p-1.5 rounded-md ${config.bgColor} h-fit`}>
                          <Icon className={`size-3.5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground text-sm">
                              {event.title}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground pt-4 border-t">
        <p className="flex items-center justify-center gap-2">
          <Rocket className="size-4 text-blue-500" />
          {totalEvents} roadmap updates captured from first idea to the current production build
        </p>
      </div>
    </div>
  )
}
