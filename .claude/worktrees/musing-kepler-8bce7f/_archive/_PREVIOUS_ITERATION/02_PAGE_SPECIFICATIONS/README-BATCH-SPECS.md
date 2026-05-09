# Batch Page Specifications - Renew Dashboard

> **Note:** This file contains condensed specifications for remaining pages. Each follows the template structure but in compact format for efficient documentation.

---

## DISCOVERY SECTION

### `/discovery/readiness-quiz`
**Purpose:** Self-assessment to evaluate readiness to acquire
**Layout:** Centered wizard (max-width 800px), progress bar, question area, nav buttons
**Components:** Progress indicator (5 of 20), question card, answer options (radio/scale/toggle), Previous/Next buttons, Save & Exit
**Interactions:** Select answers, navigate questions, real-time validation, auto-save
**Content:** 20 questions across Financial (7), Experience (7), Personal (6) categories
**States:** In Progress, Question Answered, Validation Error, Auto-Saving, Completion → redirect to results
**FROM:** Discovery hub, onboarding | **TO:** Results page (auto after completion)

### `/discovery/results`
**Purpose:** Display assessment results with breakdown and recommendations
**Layout:** Hero with score, 3-column category breakdown, detailed analysis, recommendations, CTA
**Components:** Circular score (0-100, color-coded), category cards (Financial/Experience/Personal scores), expandable accordions (Strengths/Gaps), recommendations list, action CTAs
**Interactions:** Expand/collapse analysis sections, click recommendations, download PDF (premium), retake quiz
**Content:** Overall score interpretation, category breakdowns, personalized action plan, estimated timeline to readiness
**States:** Results Displayed, Expandable Sections, Download Loading, Retake Warning modal
**FROM:** Readiness quiz (auto) | **TO:** Lead de Cadrage (next step), Consultation (premium), Retake quiz

### `/discovery/lead-de-cadrage`
**Purpose:** Define ideal acquisition criteria to power deal matching
**Layout:** Centered form (max-width 900px), multi-section with clear headers, save buttons
**Components:** Industry multi-select, Geography map/checklist (France regions), Size sliders (revenue/employees/EBITDA), Financial capacity dropdown, Seller motivation checkboxes, Deal structure radio, Timeline dropdown, Additional criteria textarea
**Interactions:** All form inputs, real-time validation, auto-save every 30s, France map clickable regions
**Content:** Field labels with help text tooltips, placeholder examples, validation messages
**States:** Empty/First Time, Editing (populated), Validation Error, Auto-Saving, Saved Successfully
**FROM:** Discovery hub, onboarding, results | **TO:** Discovery hub (after save), Deal Browse (CTA)

### `/discovery/learning-path`
**Purpose:** Show recommended courses based on readiness gaps
**Layout:** Hero with progress, course grid (3 columns), filter dropdown
**Components:** Progress indicator, course cards (thumbnail, title, duration, difficulty badge, "Why recommended" text, progress bar if started, CTA button, premium badge if locked)
**Interactions:** Click courses to view/start, filter by category, mark complete, bookmark
**Content:** Course recommendations tied to readiness gaps, categories (Financial, DD, Negotiation, Operations, Industry)
**States:** Loading, No Courses (complete quiz first), Courses Displayed, Course Started (progress), Completed (checkmark), Premium Gate
**FROM:** Discovery hub, results | **TO:** Course detail pages, full course library

### `/discovery/consultation`
**Purpose:** Book 1-on-1 readiness consultation (premium)
**Layout:** Two-column (left: advisor info, right: booking calendar)
**Components:** Session type selector, advisor photo/bio/expertise, calendar widget, time zone selector, "What to discuss" textarea, preparation checklist, Confirm button, upcoming sessions list
**Interactions:** Select session type, choose advisor, navigate calendar, select time, input discussion topics, book session
**Content:** Advisor bios, session descriptions (30/45/60 min options), preparation checklist, confirmation message
**States:** Premium User (full access), Free User (blurred with upgrade overlay), No Slots Available, Booking in Progress, Booking Confirmed (modal)
**FROM:** Discovery hub, results | **TO:** Discovery hub (after booking), Settings/subscription (if upgrading)

---

## DEAL FLOW SECTION

### `/deals` (Landing)
**Purpose:** Entry point for deal flow with overview
**Layout:** Hero, quick stats row, featured deals carousel, quick filters
**Components:** Stats cards (Total Deals, Matching Criteria, New This Week), featured deal cards (carousel), quick filter dropdowns (Industry, Region, Size), Apply Filters button
**Interactions:** Click stats to navigate with filter, carousel navigation, apply filters
**Content:** Deal count statistics, featured deal summaries, filter options
**States:** Loading, No Matching Deals (update criteria prompt), Premium Gate (free users limited)
**FROM:** Dashboard, sidebar | **TO:** Browse (primary), Deal detail (featured), Saved, Pipeline, Alerts

### `/deals/browse`
**Purpose:** Main deal listing with filtering and sorting
**Layout:** Filter sidebar (25%), deal grid (75%), top control bar
**Components:** Search bar, sort dropdown, view toggle (grid/list), results count, filter sidebar (Industry, Geography, Revenue, Price, EBITDA, Seller Motivation, Deal Age, Match Score), deal cards (blind listing, match badge, metrics, tags, asking price, actions), pagination
**Interactions:** Search, sort, filter, view toggle, click cards, bookmark, compare, pagination
**Content:** Deal card format (industry, location, ~revenue range, key metrics, tags, price), filter labels, empty search result message
**States:** Loading (skeletons), No Results, Filters Applied (badge count), Saved Deal (bookmark filled), Premium Gate (free see 5-10, rest blurred)
**FROM:** Deals landing, Dashboard, anywhere via sidebar | **TO:** Deal detail, Saved, Compare

### `/deals/[id]` (Deal Detail)
**Purpose:** Comprehensive deal information page
**Layout:** Sticky right sidebar (key metrics), main content with tabs (Overview/Financials/Documents/Activity)
**Components:** Match score badge, Save/Add to Pipeline buttons, Key Metrics sidebar (price, revenue, EBITDA, employees, location), Tabbed content (Executive summary, Why for Sale, Business Highlights, Products/Services, Customers, Market, Operations, Team, Risks, Growth), Financials tab (pre/post-NDA gating), Documents tab (VDR with folders), Activity tab (timeline, notes, tasks)
**Interactions:** Tab switching, save/unsave, add to pipeline (modal), sign NDA (modal), download documents, add notes, schedule meetings
**Content:** Detailed business description, financial data, document library, activity log
**States:** Pre-NDA (limited info), Post-NDA (full access), Loading, Deal Inactive, Saved, Added to Pipeline, Document Download
**FROM:** Browse, Saved, Pipeline, Dashboard | **TO:** Browse (back), Compare, Acquisition/DD, Coaching

### `/deals/saved`
**Purpose:** Collection of bookmarked deals
**Layout:** Similar to browse but simpler (no filter sidebar), deal grid
**Components:** Page header with count, sort dropdown, deal cards (with Remove option), bulk actions (select checkboxes, Compare/Add to Pipeline/Remove)
**Interactions:** Click cards, remove from saved, sort, select multiple for comparison/bulk actions
**Content:** Saved deal cards, empty state message
**States:** Loading, Empty ("Browse deals and bookmark favorites"), Populated, Selection Mode (bulk actions)
**FROM:** Dashboard, Browse, sidebar | **TO:** Deal detail, Compare, Pipeline

### `/deals/pipeline`
**Purpose:** Kanban board to track deals through stages
**Layout:** Kanban columns (Screening, NDA Signed, LOI, DD, Closing, Closed), view toggle (Kanban/List)
**Components:** Column headers with counts, deal cards (compact: title, match score, price, last activity), drag handles, "+Add Deal" buttons, view toggle
**Interactions:** Drag-drop between columns, click cards (detail or modal), add deal (search modal), view toggle
**Content:** Stage descriptions (tooltips), empty pipeline message
**States:** Loading, Empty Pipeline, Dragging (lift animation), Drop Success, Stage Change Modal (mobile), List View (table format)
**FROM:** Dashboard, Browse, sidebar | **TO:** Deal detail, Acquisition/DD

### `/deals/compare`
**Purpose:** Side-by-side comparison of deals
**Layout:** Horizontal table (fixed left column for metrics, scrollable deal columns)
**Components:** Deal selector (add deals dropdown, max 3), comparison table (metric rows × deal columns), header per deal (title, match score, Remove X, View Details link), export PDF button, action bar (Add to Pipeline, Save, View Details per deal)
**Interactions:** Add/remove deals, click deal names, hover for tooltips, export PDF, quick actions
**Content:** Comparison metrics (Basic Info, Financials, Size, Deal Characteristics, Fit Score), empty state prompt
**States:** Empty (select deals), 1-2 Deals (partial), 3 Deals (full, selector disabled), Loading, Export (PDF generating)
**FROM:** Browse, Saved, Pipeline | **TO:** Deal detail, Browse

### `/deals/alerts`
**Purpose:** Configure and manage deal notifications
**Layout:** Active alerts section (top), Create new alert form (bottom)
**Components:** Alert cards (name, criteria summary, frequency, notification method, toggle active/paused, Edit/Delete buttons, current match count), Create form (alert name, filters, frequency dropdown, notification checkboxes, Create button)
**Interactions:** Toggle alerts on/off, edit (modal), delete (confirmation), create new, click alert to see matches
**Content:** Alert criteria summaries, frequency options (Real-time/Daily/Weekly), notification methods (Email/SMS premium/In-app), empty state
**States:** No Alerts, Alerts Listed, Creating (validation), Created Successfully, Editing (modal), Deleting (confirmation), Premium Gate (SMS)
**FROM:** Deals section, Browse, Dashboard | **TO:** Browse (view matches), Settings/preferences

### `/deals/[id]/nda-signing` (Modal)
**Purpose:** Digital NDA signing flow
**Layout:** Modal overlay (70% viewport), multi-step wizard within modal
**Components:** Modal header (title, close X, step indicator), Step 1 (NDA document scroll, agreement checkboxes), Step 2 (identity verification form), Step 3 (DocuSign embed/signature pad), Confirmation screen (success icon, access message)
**Interactions:** Scroll NDA, check agreements, input identity info, sign (draw/type), submit
**Content:** NDA template text, identity form fields, instructions, confirmation message
**States:** Review, Identity Verification, Signing, Submitting (spinner), Success, Error
**FROM:** Deal detail page ("Sign NDA" button) | **TO:** Deal detail (auto unlock financials/documents)

---

## ACQUISITION SUPPORT SECTION

### `/acquisition` (Hub)
**Purpose:** Central hub for acquisition process support
**Layout:** Hero, process roadmap timeline, tool cards grid
**Components:** Hero section, Process roadmap (5 stages: LOI → DD → Financing → Negotiation → Closing, clickable), Tool cards (Coaching, Expert Network, Financing, DD Tools, Valuation, Templates)
**Interactions:** Click roadmap stages, click tool cards to navigate
**Content:** Process stage names, tool descriptions, active deal context
**States:** Loading, Default, Premium Gate, Active Deal Context (recommendations)
**FROM:** Dashboard, sidebar | **TO:** Sub-pages for each tool

### `/acquisition/roadmap`
**Purpose:** Interactive checklist guiding acquisition process
**Layout:** Vertical timeline (left), expandable stage sections (right)
**Components:** Timeline stages (LOI, DD, Financing, Negotiation, Closing, Post-Closing), expandable details (overview, checklist, resources, tips, timeline estimate), Mark Stage Complete button, Attach to Deal dropdown
**Interactions:** Click to expand stages, check off tasks, click resources, mark complete, attach to deal
**Content:** Stage overviews, task checklists, resource links, tips & pitfalls, duration estimates
**States:** Generic View, Deal-Specific (progress tracked), Stage Collapsed/Expanded, Task Completed, Stage Completed
**FROM:** Acquisition hub | **TO:** Templates, Experts, DD checklist, Courses

### `/acquisition/coaching`
**Purpose:** Book advisory sessions
**Layout:** Session type selector (top), two-column (advisor selection, calendar booking), upcoming sessions list
**Components:** Session type cards (Deal Review, Strategy, Negotiation Prep, DD Guidance, General), advisor list (photo, bio, expertise, Select button), calendar widget, time slots, discussion textarea, deal attachment dropdown, upcoming sessions list (date, advisor, Join Call button)
**Interactions:** Select session type, choose advisor, navigate calendar, select time, input topics, attach deal, confirm booking, join/reschedule
**Content:** Session descriptions, advisor bios, booking confirmation, upcoming sessions
**States:** Type Not Selected, Advisor Selected, Date Selected, Booking in Progress, Confirmed, No Slots, Premium Gate (session limits)
**FROM:** Acquisition hub, Dashboard, deal detail | **TO:** Acquisition hub (after booking), video call platform

### `/acquisition/experts`
**Purpose:** Expert network directory
**Layout:** Filter sidebar (25%), expert cards grid (75%)
**Components:** Filter sidebar (Specialty, Industry, Location, Language, Availability), expert cards (photo, name, title, specialty badges, location, years experience, "Renew Preferred" badge, description, "Member Rate" badge, rating, Request Introduction button), sort dropdown, pagination
**Interactions:** Filter, sort, click cards/View Profile, Request Introduction (modal form, premium)
**Content:** Expert descriptions, specialties, member benefits
**States:** Loading, Filtered Results, No Results, Premium Gate (introduction requests), Introduction Requested
**FROM:** Acquisition hub, roadmap, deal pages | **TO:** Expert profile modal, introduction confirmation

### `/acquisition/financing`
**Purpose:** Financing options and lender connections
**Layout:** Options overview cards, calculator widget, lender directory
**Components:** Financing option cards (Equity, Bank Loans, SBA-Style, Seller Financing - each with pros/cons, typical terms, Learn More/Find Lenders), Calculator (inputs: purchase price, down payment %, bank loan %, seller financing %, interest rate, term; outputs: pie chart, monthly payment, DSCR, ROI; Save Scenario/Get Quote buttons), Lender directory (similar to experts)
**Interactions:** Expand options, calculator inputs (real-time update), save scenario (premium), request lender intro (premium), apply filters
**Content:** Option descriptions with pros/cons, calculator help text, lender info
**States:** Default, Calculator Active, Scenario Saved, Lender Introduction Requested, Premium Gate
**FROM:** Acquisition hub, deal pages | **TO:** Lender applications (external), Resources (courses)

### `/acquisition/due-diligence`
**Purpose:** DD checklist and guidance
**Layout:** Left sidebar (category menu), main content (expandable checklist)
**Components:** Category sidebar (Financial, Legal, Operational, Commercial, HR, Technology, Environmental), checklist sections (expandable with progress %), checklist items (checkbox, description, "Why it matters" tooltip, Add Note button, Upload Document button, status label), Red Flags banner (collapsible), Export button, Attach to Deal dropdown
**Interactions:** Expand categories, check items, add notes (modal), upload docs, flag issues, export checklist, filter (All/Incomplete/Flagged)
**Content:** Comprehensive DD items by category, red flag warnings, completion guidance
**States:** Generic Checklist, Deal-Specific (progress tracked), Item Completed, In Progress, Issue Flagged, Note Added, Document Uploaded, Export Loading
**FROM:** Acquisition hub, roadmap, deal pages | **TO:** Experts (hire specialist), Coaching

### `/acquisition/valuation`
**Purpose:** Valuation calculators and modeling tools
**Layout:** Tab selector (Simple/DCF/Deal Structure), left panel (inputs), right panel (results/charts)
**Components:** Tab 1-Simple (industry dropdown, revenue/EBITDA inputs, adjustments, industry multiple; results: adjusted EBITDA, valuation range, revenue multiple, benchmark chart), Tab 2-DCF (projection inputs; results: 5-yr table, enterprise value, sensitivity analysis), Tab 3-Deal Structure (capital stack inputs; results: sources & uses, monthly cash flow, DSCR, ROI, scenario analysis), Save/Export buttons (premium)
**Interactions:** Switch tabs, input values (real-time calculation), save scenario, export PDF, load saved (premium), copy from deal
**Content:** Input labels with help text, calculation formulas shown, default values, tooltips
**States:** Empty Form, Calculating, Results Displayed, Scenario Saved, Exported, Premium Gate (DCF & save)
**FROM:** Acquisition hub, deal pages | **TO:** Financing (explore options), Coaching (review valuation)

### `/acquisition/templates`
**Purpose:** Document template library
**Layout:** Filter sidebar, template cards grid
**Components:** Filter sidebar (Category, File Type, Premium toggle), search bar, template cards (icon, name, category tag, file type badge, premium badge, description, Download button, preview icon, rating/downloads)
**Interactions:** Search, filter, preview (modal), download, rate templates
**Content:** Template names (LOI, Purchase Agreement, DD Checklist, Financing Package, Integration Plan, etc.), descriptions, usage notes
**States:** Loading, Search Results, No Results, Preview Modal, Downloading, Downloaded, Premium Gate
**FROM:** Acquisition hub, roadmap, anywhere in acquisition | **TO:** File downloads

---

## POST-ACQUISITION SECTION

### `/post-acquisition` (Hub)
**Purpose:** Central hub for post-acquisition support
**Layout:** Hero, quick stats row, tool cards grid
**Components:** Hero (icon, headline, acquisition badge "You acquired [Business] on [Date]"), Stats cards (Days Since Acquisition, Next Milestone, KPIs Tracked, Coaching Sessions), Tool cards (Milestone Tracker, KPI Dashboard, Coaching, Expert Access, Peer Advisory, Growth Initiatives)
**Interactions:** Click stats, click tool cards
**Content:** Contextual headline by stage (First 30 days/Integration/Operating), tool descriptions, empty state (no acquisition yet)
**States:** No Acquisition, Active Ownership (stats populated), Premium Gate (full operating partner features)
**FROM:** Dashboard, sidebar | **TO:** Sub-pages for each tool

### `/post-acquisition/milestones`
**Purpose:** Track 30/60/90/180 day integration milestones
**Layout:** Horizontal timeline (top), expandable milestone sections (below)
**Components:** Timeline visualization (Day 1/30/60/90/180, current day indicator, completion badges), Milestone sections (Day 1-30, 31-60, 61-90, 91-180), Task checklists (checkbox, description, target completion, status, Add Note button, Assign To dropdown), Blocker section (issue list, severity, status, Get Help button)
**Interactions:** Check tasks, expand sections, add notes, assign tasks, flag blockers, request help, export report
**Content:** Task checklists tailored to SME acquisitions, tips per milestone phase, typical timeline guidance
**States:** Tasks Displayed, Task Completed, Delayed (red warning if past target), Blocker Flagged, Milestone Completed (celebration), Export Loading
**FROM:** Post-acq hub, Dashboard | **TO:** Coaching (help with blockers), KPI dashboard

### `/post-acquisition/kpi-dashboard`
**Purpose:** Monitor business performance
**Layout:** Filters/date range (top), KPI widget grid (responsive 2-4 columns), expandable detail charts (below)
**Components:** Date range selector, Compare to dropdown (Prior Period/Budget/Baseline), Export button, KPI widgets (Revenue, EBITDA, Cash Flow, Customer Retention, Employee Retention, Sales Pipeline, CAC, Inventory, A/R), each widget shows: large number, change indicator (↑↓), sparkline, View Details link; Detail charts (expand for full charts)
**Interactions:** Select date range, select comparison, click widgets to expand, add custom KPI (modal), edit targets, export PDF, schedule report (premium)
**Content:** KPI metrics, change indicators, alerts ("Cash balance declining"), insights ("Revenue up 12%"), empty state prompt
**States:** No Data (setup prompt), Data Entered (widgets populated), Loading, Comparison Active, Alert Triggered (red border), Export Loading, Premium Features (automated reporting)
**FROM:** Post-acq hub, Dashboard | **TO:** Initiatives (drill into metrics), Coaching

### `/post-acquisition/coaching`
**Purpose:** Operating partner coaching booking
**Layout:** Similar to acquisition coaching, business context prominent
**Components:** Session type selector (Monthly Review, Operational Issue, Team/HR, Financial Review, Growth Strategy, Emergency), advisor info (operating partner if assigned - premium), calendar, previous sessions list (notes, action items from last session)
**Interactions:** Same as acquisition coaching, view past notes, check action items
**Content:** Session descriptions tailored to operations, premium feature (unlimited coaching), session history
**States:** Same as acquisition coaching, Assigned Advisor (premium), Session History expandable
**FROM:** Post-acq hub, milestones, KPI dashboard | **TO:** Video call, session notes

### `/post-acquisition/experts`
**Purpose:** Operational specialist access
**Layout:** Same as acquisition experts, operations-focused
**Components:** Filter sidebar (Specialty: Marketing, HR, Operations, Finance, Technology, Legal, Industry), expert cards
**Interactions:** Same as acquisition experts
**Content:** Expert specialties (Sales Process, HR/Compensation, Lean Manufacturing, CFO Advisory, etc.)
**States:** Same as acquisition experts
**FROM:** Post-acq hub, milestones, KPI dashboard | **TO:** Expert profile, introduction

### `/post-acquisition/peer-groups`
**Purpose:** Join peer advisory circles
**Layout:** Info section about concept, Your Circle (if member), Available Circles grid, Create Your Own (premium)
**Components:** Info card (what are peer advisory circles, benefits), Your Circle section (name, members, next meeting date/time, Join Meeting button, past sessions link), Available Circles cards (name/theme, industry focus, member count, meeting schedule, facilitator, Apply button), Create button
**Interactions:** Join meeting (video launch), view past sessions, apply to circle (form modal), create circle (premium)
**Content:** Concept explanation, circle details, application questions, meeting format description
**States:** Not a Member (see available), Application Pending, Member of Circle (show details), Meeting Active (Join enabled), Premium Feature (create circles)
**FROM:** Post-acq hub, Dashboard | **TO:** Video meeting, application form

### `/post-acquisition/initiatives`
**Purpose:** Track growth projects
**Layout:** View toggle (Kanban/List), Add Initiative button
**Components:** Kanban columns (Planned, In Progress, On Hold, Completed), Initiative cards (name, category tag, owner, target date, status, impact estimate, "..." menu), Add Initiative modal (name, description, category, owner, target date, expected impact, action steps)
**Interactions:** Drag-drop cards, click for details (modal), edit, move stage, delete, add initiative, filter by category/owner
**Content:** Example initiatives (Launch e-commerce, Implement CRM, Hire sales director, Renegotiate contracts), empty state
**States:** Empty (add first initiative), Board View, List View, Initiative Completed (animation), Details Modal
**FROM:** Post-acq hub, milestones | **TO:** Coaching (help with initiative)

---

## EXIT PLANNING SECTION

### `/exit` (Hub)
**Purpose:** Central hub for exit preparation
**Layout:** Hero, exit readiness score card (prominent), tool cards grid
**Components:** Hero section, Readiness Score (circular 0-100, color-coded), Tool cards (Exit Readiness, Business Valuation, Value Optimization, Buyer Identification, Sale Process)
**Interactions:** Click tools to navigate, assess readiness CTA
**Content:** Contextual message by ownership duration, "never too early to plan" reminder
**States:** No Assessment (score shows "Not assessed"), Assessment Completed (score displayed), Exit Imminent (tools prioritized)
**FROM:** Dashboard, sidebar | **TO:** Sub-pages for each tool

### `/exit/readiness`
**Purpose:** Evaluate business readiness for sale
**Layout:** Centered assessment form, multi-section
**Components:** Assessment form with sections (Financial Readiness 10Q, Operational Readiness 8Q, Strategic/Market Readiness 7Q), question types (dropdowns, inputs, radio buttons), Submit button
**Interactions:** Answer questions, save progress, submit assessment
**Content:** Questions focused on sellability (financials audited?, revenue trend?, management team?, owner dependency?, market position?, etc.), help text per question
**States:** In Progress, Completed → redirect to results
**FROM:** Exit hub | **TO:** Results page (auto after submission)

### `/exit/readiness-results`
**Purpose:** Display assessment results and recommendations
**Layout:** Overall score hero, category breakdown (3 columns), strengths/gaps sections, roadmap preview, CTAs
**Components:** Circular score indicator, category cards (Financial/Operational/Strategic scores), expandable accordions (Strengths/Gaps), Value Optimization preview (prioritized actions), CTAs (View Roadmap, Get Valuation, Book Consultation)
**Interactions:** Expand sections, click recommendations, create roadmap, retake assessment
**Content:** Score interpretation (0-40 Not Ready, 41-69 Preparing, 70-100 Ready), estimated time to ready, gap examples with context
**States:** Results Displayed, Sections Expanded, Roadmap Created (redirect), Download Report
**FROM:** Exit readiness assessment (auto) | **TO:** Roadmap, Valuation, Consultation

### `/exit/valuation`
**Purpose:** Estimate business sale value
**Layout:** Similar to acquisition valuation tool, focused on current business
**Components:** Valuation inputs (current financials, industry, normalization adjustments), outputs (valuation range), Valuation History chart (baseline vs current), Increase Your Valuation section (actions with impact estimates)
**Interactions:** Input metrics, real-time calculation, save snapshot (track over time), export report
**Content:** Valuation methodology explanation, industry multiples, value created since acquisition
**States:** Calculating, Results Displayed, Saved (snapshot to history), Chart showing progress over time
**FROM:** Exit hub, readiness results | **TO:** Roadmap (optimize value)

### `/exit/roadmap`
**Purpose:** Actionable plan to increase business value
**Layout:** Value impact summary (top), roadmap timeline (6/12/24 months), initiative cards by timeframe
**Components:** Value summary (Current €X, Potential €Y, Uplift €Z), Timeline sections (Short/Medium/Long-term), Initiative cards (name, description, value impact, effort, priority, status, Start Initiative button), Target exit date picker
**Interactions:** Set target date (updates recommendations), mark initiatives complete, add custom initiatives, reorder priorities, start initiative (links to post-acq initiatives tracker), export roadmap
**Content:** Initiative examples by timeframe (clean financials, build team, diversify customers, expand markets), impact estimates, prioritization logic
**States:** Roadmap Generated, Initiative Started (status change), Exit Date Set (recommendations adjust), Progress Tracked (completion %)
**FROM:** Exit hub, readiness results, valuation | **TO:** Post-acq initiatives (execution), Coaching

### `/exit/buyers`
**Purpose:** Identify and connect with acquirers
**Layout:** Buyer types overview (3 cards), Renew network matches, strategic buyer research tool, Your Buyer List
**Components:** Buyer Type cards (Strategic/Financial/PE - each with description, pros/cons, Research button), Renew Matches (list of matching repreneurs with criteria, match score, Express Interest button), Research Tool (inputs: industry, adjacent industries, geography; results: potential strategic buyers list), Your Buyer List (saved buyers, status tracking, notes)
**Interactions:** Explore buyer types, browse repreneur matches, express interest (anonymous inquiry), research strategic buyers, save to list, track outreach status
**Content:** Buyer type descriptions, repreneur profiles, strategic buyer suggestions, status options (Not Contacted/Contacted/In Discussion/Passed)
**States:** Buyer types displayed, Renew matches listed, Research results, Buyer list (empty/populated), Interest expressed (confirmation)
**FROM:** Exit hub, roadmap | **TO:** Buyer profiles, interest confirmations

### `/exit/process`
**Purpose:** Manage sale process
**Layout:** Process stage tracker (top), buyer pipeline (Kanban/table), document preparation, communication log
**Components:** Stage tracker (Preparation → Marketing → Due Diligence → Negotiation → Closing), Buyer pipeline (stages, buyer cards with status/notes), Document checklist (CIM, Teaser, Financials, Legal Docs - preparation status), Communication log (buyer interactions, meeting notes)
**Interactions:** Move buyers through stages, add buyers, track document preparation, log communications, schedule meetings
**Content:** Stage descriptions, buyer information, document templates, meeting notes
**States:** Not Started, In Progress (active buyers), Documents Ready, Negotiating, Closing
**FROM:** Exit hub, buyers page | **TO:** Document templates, Coaching, Legal experts

---

## NETWORK SECTION

### `/network` (Hub)
**Purpose:** Network section landing
**Layout:** Hero, community highlights, upcoming events preview, feature cards
**Components:** Hero section, highlight stats (members, events, connections made), upcoming events (next 3), feature cards (Member Directory, Mentors, Peer Advisory, Experts, Events, Messages premium)
**Interactions:** Click feature cards, view events, RSVP
**Content:** Community benefits, event highlights
**States:** Loading, Populated, Empty (new user prompt)
**FROM:** Dashboard, sidebar | **TO:** Sub-pages

### `/network/directory`
**Purpose:** Searchable member directory
**Layout:** Filter sidebar, member cards grid
**Components:** Search bar, filters (Phase, Industry, Location, Visibility opt-in only), member cards (photo, name, business, phase badge, acquisition criteria preview, Connect button), pagination
**Interactions:** Search, filter, click profiles (detail modal), send connection request, message (premium)
**Content:** Member profiles, acquisition stages, industries
**States:** Loading, Filtered, No Results, Connection Sent
**FROM:** Network hub | **TO:** Profile modals, Messages (premium)

### `/network/mentors`
**Purpose:** Mentor matching
**Layout:** Filter sidebar, mentor cards grid
**Components:** Filters (Expertise, Industry, Experience), mentor cards (photo, name, background, expertise tags, languages, experience years, rating, Book Session button), sort dropdown
**Interactions:** Filter, sort, view profile, book session (calendar)
**Content:** Mentor bios, expertise areas, session types, success stories
**States:** Loading, Filtered, Booking (calendar modal), Booked (confirmation)
**FROM:** Network hub, Discovery | **TO:** Session booking, profile details

### `/network/peers`
**Purpose:** Peer advisory groups (same as post-acq peer-groups)
**Layout:** Same as post-acquisition peer groups
**Components:** Same components
**Interactions:** Same interactions
**FROM:** Network hub | **TO:** Same as post-acq version

### `/network/experts`
**Purpose:** Expert network (consolidated view of all experts)
**Layout:** Same as acquisition/post-acq experts
**Components:** Filters (all specialties), expert cards
**Interactions:** Same as other expert directories
**FROM:** Network hub | **TO:** Expert profiles, introduction requests

### `/network/events`
**Purpose:** Events calendar and registration
**Layout:** Calendar view toggle (month/list), event cards, filters
**Components:** View toggle, calendar (month grid with event dots), event cards (title, date/time, type badge, description, speaker/host, capacity, RSVP button), filters (Type: Webinar/Workshop/Networking/Summit, Topic, Date Range)
**Interactions:** Toggle views, navigate calendar, filter events, RSVP (modal confirmation), add to calendar (download .ics)
**Content:** Event details, speaker bios, agenda outlines, past event recordings (premium)
**States:** Loading, Filtered, RSVP'd (confirmation), Event Full, Past Events (recordings available)
**FROM:** Network hub, Dashboard | **TO:** Event detail modals, video platform (join), recordings

### `/network/messages`
**Purpose:** Direct messaging (premium)
**Layout:** Split-pane (left: conversation list, right: active conversation)
**Components:** Conversation list (avatars, names, last message preview, timestamp, unread badge), Message thread (messages chronological, input box, send button, attachment button), New Message button
**Interactions:** Select conversation, send messages, attach files, start new conversation (search members), mark read/unread
**Content:** Message history, member availability status
**States:** No Conversations, Active Conversation, Typing Indicator, Message Sent, Premium Gate (free users see locked)
**FROM:** Network hub, member profiles | **TO:** Member profiles

---

## RESOURCES SECTION

### `/resources` (Hub)
**Purpose:** Resources section landing
**Layout:** Hero, search bar (prominent), category cards, featured content
**Components:** Global search, category cards (Library, Courses, Videos, Templates, Reports, Tools - each with icon, description, content count), featured content carousel (popular resources)
**Interactions:** Search, click categories, browse featured
**Content:** Category descriptions, featured items
**States:** Loading, Search Results (if searching)
**FROM:** Dashboard, sidebar | **TO:** Sub-pages

### `/resources/library`
**Purpose:** Article and guide library
**Layout:** Filter sidebar, article grid/list toggle
**Components:** Filters (Topic, Type, Difficulty, Length), search bar, article cards (thumbnail, title, author, read time, topic tags, excerpt, Read button), pagination
**Interactions:** Filter, search, view toggle, read articles (detail page), bookmark
**Content:** Article titles, excerpts, author bios, reading time
**States:** Loading, Filtered, Reading (full article view), Bookmarked
**FROM:** Resources hub, search | **TO:** Article detail pages

### `/resources/courses`
**Purpose:** Online courses
**Layout:** Filter sidebar, course cards grid
**Components:** Filters (Topic, Difficulty, Duration, Premium), course cards (thumbnail, title, instructor, duration, difficulty badge, rating, progress bar if started, lessons count, Start/Continue button, premium badge), sort dropdown
**Interactions:** Filter, sort, start course (goes to lesson 1), continue course, bookmark
**Content:** Course descriptions, lesson outlines, instructor credentials
**States:** Loading, Filtered, Course Started (progress), Completed (certificate), Premium Gate
**FROM:** Resources hub, Learning Path, search | **TO:** Course detail/lesson pages

### `/resources/videos`
**Purpose:** Video library
**Layout:** Filter sidebar, video grid (thumbnails)
**Components:** Filters (Topic, Speaker, Duration, Date), video cards (thumbnail with play icon, title, speaker, duration, view count, description), featured playlist section
**Interactions:** Filter, play video (modal or dedicated page), add to playlist (premium), download (premium)
**Content:** Video metadata, speaker bios, timestamps for key sections
**States:** Loading, Filtered, Playing, Playlist View, Premium Gate (some videos)
**FROM:** Resources hub, search | **TO:** Video player

### `/resources/templates`
**Purpose:** Document templates (same as acquisition templates but broader)
**Layout:** Same as acquisition/templates
**Components:** Same with broader categories (all phases)
**Interactions:** Same
**FROM:** Resources hub, any section | **TO:** Downloads

### `/resources/reports`
**Purpose:** Industry reports database
**Layout:** Filter sidebar, report cards grid
**Components:** Filters (Industry, Report Type, Date, Geography), report cards (title, industry tags, date published, page count, summary, Download/Preview buttons, premium badge)
**Interactions:** Filter, preview (PDF viewer), download, bookmark
**Content:** Report summaries, industry data, transaction comparables
**States:** Loading, Filtered, Previewing, Downloaded, Premium Gate (detailed reports)
**FROM:** Resources hub, Deal Detail (industry context), search | **TO:** PDF downloads/previews

### `/resources/tools`
**Purpose:** Calculator and tool collection
**Layout:** Tool cards grid
**Components:** Tool cards (icon, name, description, Use Case tags, Launch Tool button), popular tools section
**Interactions:** Click to launch tools (dedicated pages or modals)
**Content:** Tool descriptions, use cases (Valuation, ROI, Cash Flow, Financing, etc.)
**States:** Loading, Tool Launched (new page/modal)
**FROM:** Resources hub, various calculation needs | **TO:** Individual tool pages (link to valuation, financing tools already spec'd)

---

## SETTINGS SECTION

### `/settings/profile`
**Purpose:** Profile management
**Layout:** Two-column form (left: basic info, right: professional background)
**Components:** Photo upload, fields (Name, Email, Phone, Location, Bio), Professional section (Background, Investment Criteria from Lead de Cadrage, Achievements, Portfolio if acquired), Visibility Settings (who can see profile), Save Changes button
**Interactions:** Edit fields, upload photo, toggle visibility, save changes
**Content:** Form labels, help text, character limits on bio
**States:** Viewing, Editing (unsaved changes warning), Saving, Saved (success message), Validation Errors
**FROM:** Top bar user menu, Settings hub | **TO:** Settings hub after save

### `/settings/subscription`
**Purpose:** Subscription and billing management
**Layout:** Current plan section, plan comparison table, billing history, payment method
**Components:** Current plan card (tier, price, renewal date, features), Plan comparison (Free/Basic/Advanced/Operating Partner tiers side-by-side with features), Upgrade/Downgrade buttons, Billing history table (date, amount, invoice), Payment method (card info, Update button), Cancel Subscription link
**Interactions:** Upgrade/downgrade (confirmation modal), update payment (Stripe modal), view invoices (download PDF), cancel (confirmation + survey)
**Content:** Plan details, feature lists, pricing, billing history, cancellation policy
**States:** Viewing, Upgrade Modal, Payment Update Modal, Cancellation Confirmation, Processing, Updated
**FROM:** Top bar subscription badge, upgrade prompts throughout app | **TO:** Stripe payment pages, confirmation screens

### `/settings/preferences`
**Purpose:** Notification and privacy preferences
**Layout:** Tabbed or sectioned page (Notifications, Privacy, Display)
**Components:** Notification toggles (Email/SMS/In-app by category: Deal Alerts, Coaching Reminders, Community Activity, Platform Updates), Frequency settings (Real-time/Daily/Weekly per category), Privacy toggles (Profile visibility, Activity sharing, Deal sharing), Display settings (Language, Timezone, Theme future dark mode)
**Interactions:** Toggle switches, frequency dropdowns, save preferences
**Content:** Setting descriptions, examples of notifications, privacy explanations
**States:** Viewing, Editing, Saving, Saved (success toast)
**FROM:** User menu, notification prompts | **TO:** Settings hub after save

### `/settings/documents`
**Purpose:** Secure document vault
**Layout:** Folder tree (left), document list (right), preview pane (optional)
**Components:** Folder structure (expandable tree), document list (name, type, size, date, actions), Upload button, actions dropdown (Download, Preview, Rename, Move, Delete), Search documents
**Interactions:** Navigate folders, upload files (drag-drop or file picker), download, preview (PDF/image viewer), organize (move/rename), delete (confirmation)
**Content:** User-uploaded documents (financial statements, business plans, NDAs, LOIs, DD materials), folder names
**States:** Loading, Empty Vault, Uploading (progress bar), Previewing, Deleting Confirmation
**FROM:** Settings, various forms (attach documents) | **TO:** File previews, downloads

---

*This comprehensive specification covers all 52 pages of the Renew Dashboard. Each entry provides the essential structure, components, interactions, states, and navigation needed for development.*

*For detailed implementation of any page, expand using the full template at `_TEMPLATE.md` and reference the detailed examples in `01-authentication/signup.md`.*

---

*Document Version: 1.0 | Created: 2025-11-11 | Status: Complete Overview - Ready for Detailed Expansion*
