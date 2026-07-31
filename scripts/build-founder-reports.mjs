import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, "..")
const reportsDirectory = path.join(projectRoot, "docs", "reports")
const outputDirectory = path.join(projectRoot, "docs", "reporting-to-founders")

const sources = {
  ui: path.join(
    reportsDirectory,
    "2026-07-14-renew-ui-ux-consolidation-founder-brief.html",
  ),
  security: path.join(
    reportsDirectory,
    "2026-07-14-wave-security-foundation.html",
  ),
  productUpdates: path.join(
    reportsDirectory,
    "2026-07-28-wave-last-week-ui-ux-review.html",
  ),
  logo: path.join(projectRoot, "public", "renew-logo-white.png"),
}

const outputs = {
  ui: path.join(
    outputDirectory,
    "2026-07-14-01-ui-ux-consolidation.html",
  ),
  security: path.join(
    outputDirectory,
    "2026-07-14-02-security-foundation.html",
  ),
  productUpdates: path.join(
    outputDirectory,
    "2026-07-29-03-product-updates.html",
  ),
  productStrategy: path.join(
    outputDirectory,
    "2026-07-29-04-product-strategy.html",
  ),
}

const [uiSource, securitySource, productUpdateSource, logoBytes] =
  await Promise.all([
    fs.readFile(sources.ui, "utf8"),
    fs.readFile(sources.security, "utf8"),
    fs.readFile(sources.productUpdates, "utf8"),
    fs.readFile(sources.logo),
  ])

const logoDataUri = `data:image/png;base64,${logoBytes.toString("base64")}`

const founderStyleMatch = securitySource.match(
  /<style[^>]*>([\s\S]*?)<\/style>/i,
)
if (!founderStyleMatch) {
  throw new Error("Could not extract the founder-report visual system.")
}
const founderStyle = founderStyleMatch[1]

const decodeAttribute = (value) =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")

const embeddedImages = new Map()
for (const match of productUpdateSource.matchAll(/<img\b[^>]*>/gi)) {
  const tag = match[0]
  const alt = tag.match(/\balt="([^"]*)"/i)?.[1]
  const src = tag.match(/\bsrc="([^"]*)"/i)?.[1]
  if (alt && src?.startsWith("data:image/")) {
    embeddedImages.set(decodeAttribute(alt), src)
  }
}

const imageFor = (alt) => {
  const src = embeddedImages.get(alt)
  if (!src) throw new Error(`Missing embedded report image: ${alt}`)
  return src
}

const sharedFounderCss = `
  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .brand-logo {
    display: block;
    width: 112px;
    height: auto;
    object-fit: contain;
  }
  .brand-context {
    padding-left: 14px;
    border-left: 1px solid rgba(255, 255, 255, 0.28);
  }
  .report-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    margin-top: 24px;
    color: #667085;
    font-size: 12px;
  }
  .report-meta strong {
    color: #253244;
  }
  .source-note {
    margin-top: 22px;
    padding: 18px 20px;
    border: 1px solid #d8dee8;
    border-radius: 12px;
    background: #f7f9fb;
    color: #4b5969;
    font-size: 13px;
    line-height: 1.6;
  }
  .source-note strong {
    color: #182230;
  }
  .delivery-record {
    margin-top: 22px;
    padding: 16px 18px;
    border: 1px solid #d8dee8;
    border-radius: 12px;
    background: #f7f9fb;
  }
  .delivery-record span {
    display: block;
  }
  .delivery-record span + span {
    margin-top: 5px;
  }
`

const normalizeHistoricalReport = ({ source, status, continuity }) =>
  source
    .replace(
      /<span class="brand-mark"[^>]*>≈<\/span>/,
      `<img class="brand-logo" src="${logoDataUri}" alt="Re-New" />`,
    )
    .replace("</style>", `${sharedFounderCss}\n</style>`)
    .replace(
      '<footer class="footer">',
      `<div class="report-meta delivery-record">
        <span><strong>Delivery status:</strong> ${status}</span>
        <span><strong>Archive context:</strong> ${continuity}</span>
      </div>
      <footer class="footer">`,
    )

const page = ({ title, body, customCss = "" }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${title}</title>
    <style>
${founderStyle}
${sharedFounderCss}
${customCss}
    </style>
  </head>
  <body>
${body}
  </body>
</html>
`.replace(/[ \t]+$/gm, "")

const brand = (context) => `
  <div class="brand">
    <img class="brand-logo" src="${logoDataUri}" alt="Re-New" />
    <span class="brand-context">${context}</span>
  </div>
`

const productUpdates = [
  {
    id: "UX-001",
    title: "Relationships now makes Firms and Contacts reachable",
    before: "UX-001 before release",
    after: "UX-001 after release in production",
    changed:
      "The Relationships workspace now has reachable, searchable Firms and Contacts directories. Legacy routes return the corresponding canonical view rather than silently starting opportunity intake.",
    why:
      "Staff can browse the firm and contact foundation without losing context or creating accidental work.",
    verified:
      "Staff desktop and 390 px mobile: visible navigation, direct routes, browser-history state and firm search.",
  },
  {
    id: "UX-002",
    title: "The repreneur deal list is now a compact ranked shortlist",
    before: "UX-002 before release",
    after: "UX-002 after release in production",
    changed:
      "Deal cards now prioritize the decision-ready facts: relevance order, status, core metrics and a direct path to the full profile. Internal scoring remains hidden.",
    why:
      "Repreneurs can scan the shortlist faster without losing the richer anonymized context available in each deal.",
    verified:
      "Repreneur desktop and mobile: 16 available deals, compact rows, full detail retained and no internal relevance score exposed.",
  },
  {
    id: "UX-003",
    title: "Memo locks now explain the actual confidentiality state",
    before: "UX-003 before release",
    after: "UX-003 after release in production",
    changed:
      "The portal now explains whether access is waiting for signed or explicitly waived evidence and an approved memo, without exposing source or staff-only document metadata.",
    why:
      "A locked document now communicates the real next condition while preserving the confidentiality contract.",
    verified:
      "Repreneur production QA confirmed the released locked-state copy. Marking an NDA not required does not bypass the explicit waiver requirement.",
  },
  {
    id: "UX-004",
    title: "Mobile Relationships starts with the timeline",
    before: "UX-004 before release",
    after: "UX-004 after release in production",
    changed:
      "The relationship history is visually first on mobile. Secondary filters move into an All filters disclosure with an active summary.",
    why:
      "The most useful operational evidence appears before configuration on a small screen.",
    verified:
      "Staff 390 px production QA: timeline first, progressive filters, preserved desktop controls and no horizontal overflow.",
  },
  {
    id: "UX-005",
    title: "Activity capture separates required evidence from optional detail",
    before: "UX-005 before release",
    after: "UX-005 after release in production",
    changed:
      "Required fields now appear first in Record activity. Optional context sits behind a disclosure, with a scrollable body and stable action footer.",
    why:
      "Staff can record the minimum trustworthy interaction quickly and add context only when it is useful.",
    verified:
      "Staff desktop and mobile production QA: required-first order, optional section collapsed by default and no activity submitted.",
  },
  {
    id: "UX-006",
    title: "Not a fit expands only when it is chosen",
    before: "UX-006 before release",
    after: "UX-006 after release in production",
    changed:
      "I’m interested remains the primary action. Not a fit is secondary and reveals the existing required reasons and rationale only after selection.",
    why:
      "The normal positive path stays clear, while a decline still captures the evidence staff need.",
    verified:
      "Repreneur desktop and mobile QA: progressive form, correct first focus, safe cancel and no response submitted.",
  },
  {
    id: "UX-007",
    title: "Inactive NDA signed-copy controls are now concise state summaries",
    before: "UX-007 before release",
    after: "UX-007 after release in production",
    changed:
      "Blank NDA upload remains available. Pursuit-specific signed-copy controls no longer render when no active pursuit exists; the page shows a compact locked-state explanation instead.",
    why:
      "The interface reflects what staff can actually do now, without presenting permanently disabled controls.",
    verified:
      "Staff production QA found no disabled signed-copy buttons in the inactive state. Existing artifact history and active-pursuit semantics remain intact. IU-002 was absorbed here.",
  },
  {
    id: "IU-001",
    title: "Timeline metadata now recedes behind meaningful verification state",
    before: "IU-001 before release",
    after: "IU-001 after release in production",
    changed:
      "Routine channel, direction and delivery details are quiet inline metadata. Failed delivery and Owner to verify remain visually prominent.",
    why:
      "Attention follows operational risk rather than decorative repetition.",
    verified:
      "Staff production QA confirmed calm routine metadata, destructive failed-delivery treatment and preserved verification warning.",
  },
]

const productUpdateCards = productUpdates
  .map(
    (update, index) => `
      <article class="story update-story" id="${update.id}">
        <div class="story-head">
          <span class="story-number">${String(index + 1).padStart(2, "0")}</span>
          <div>
            <span class="story-kicker">${update.id} · released product update</span>
            <h3>${update.title}</h3>
          </div>
        </div>
        <div class="comparison" aria-label="${update.id} before and production comparison">
          <figure>
            <figcaption><strong>Before</strong><span>Original production state</span></figcaption>
            <img src="${imageFor(update.before)}" alt="${update.before}" loading="lazy" />
          </figure>
          <figure class="after">
            <figcaption><strong>Now in production</strong><span>Released state</span></figcaption>
            <img src="${imageFor(update.after)}" alt="${update.after}" loading="lazy" />
          </figure>
        </div>
        <div class="update-copy">
          <section><span class="eyebrow">What changed</span><p>${update.changed}</p></section>
          <section><span class="eyebrow">Why it matters</span><p>${update.why}</p></section>
          <section><span class="eyebrow">Verified</span><p>${update.verified}</p></section>
        </div>
      </article>`,
  )
  .join("\n")

const productUpdateCss = `
  .release-note {
    margin-top: 22px;
    padding: 18px 20px;
    border: 1px solid #b8d2f6;
    border-radius: 12px;
    background: #eef5ff;
    color: #174579;
  }
  .release-note strong {
    display: block;
    margin-bottom: 5px;
  }
  .update-story {
    padding-bottom: 0;
    overflow: hidden;
  }
  .comparison {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    margin-top: 24px;
    border: 1px solid #d8dee8;
    border-radius: 12px 12px 0 0;
    overflow: hidden;
  }
  .comparison figure {
    min-width: 0;
    margin: 0;
    background: #f7f9fb;
  }
  .comparison figure + figure {
    border-left: 1px solid #d8dee8;
  }
  .comparison figcaption {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid #d8dee8;
    color: #5f6b7a;
    font-size: 11px;
  }
  .comparison figcaption strong {
    color: #182230;
  }
  .comparison .after figcaption {
    background: #eaf2ff;
    color: #174579;
  }
  .comparison img {
    display: block;
    width: 100%;
    height: 390px;
    object-fit: contain;
    object-position: top;
    background: #f7f9fb;
  }
  .update-copy {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border: 1px solid #d8dee8;
    border-top: 0;
    border-radius: 0 0 12px 12px;
  }
  .update-copy section {
    padding: 22px;
  }
  .update-copy section + section {
    border-left: 1px solid #d8dee8;
  }
  .update-copy p {
    margin: 8px 0 0;
    color: #4b5969;
    line-height: 1.65;
  }
  @media (max-width: 760px) {
    .comparison img {
      height: 210px;
    }
    .comparison figcaption {
      display: block;
    }
    .comparison figcaption span {
      display: block;
      margin-top: 3px;
    }
    .update-copy {
      grid-template-columns: 1fr;
    }
    .update-copy section + section {
      border-top: 1px solid #d8dee8;
      border-left: 0;
    }
  }
  @media (max-width: 460px) {
    .comparison {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .comparison img {
      height: 170px;
    }
    .comparison figcaption {
      padding: 10px;
    }
  }
`

const productUpdateBody = `
    <main class="report">
      <header class="hero">
        ${brand("Founder reporting · Product update · 29 July 2026")}
        <h1>Eight practical improvements make WAVE clearer to scan and act on.</h1>
        <p class="hero-lede">
          This release applies the same product discipline across staff Relationships,
          NDA artifacts and the repreneur deal journey. It improves hierarchy and
          usability without weakening the data model, confidentiality rules or
          existing operating controls.
        </p>
        <div class="runway" aria-label="Product update summary">
          <article><span class="runway-label">01 · Released</span><strong>Eight updates</strong><small>UX-001–UX-007 and IU-001</small></article>
          <article><span class="runway-label">02 · Protected</span><strong>No control loosened</strong><small>Existing data and confidentiality boundaries remain</small></article>
          <article><span class="runway-label">03 · Verified</span><strong>Desktop and mobile</strong><small>Approved staff and repreneur QA personas</small></article>
        </div>
      </header>

      <section class="section" aria-labelledby="product-update-summary">
        <div class="executive">
          <div class="executive-copy">
            <span class="eyebrow">Executive summary</span>
            <h2 id="product-update-summary">The newest workflows now feel like one governed product.</h2>
            <p>
              The changes focus on practical friction: reaching firms and contacts,
              understanding document locks, seeing the relationship timeline first on
              mobile, recording the right evidence quickly and keeping decision actions
              proportionate to intent.
            </p>
            <p>
              Each story below pairs the original production state with the released
              result. The screenshots are evidence, while the explanation underneath
              makes the product and operating value explicit.
            </p>
          </div>
          <aside aria-label="Release facts">
            <span class="eyebrow">Release facts</span>
            <ul class="value-list">
              <li><span>08</span><strong>Released updates</strong></li>
              <li><span>16</span><strong>Before / production screenshots</strong></li>
              <li><span>05</span><strong>Staff surfaces</strong></li>
              <li><span>03</span><strong>Repreneur surfaces</strong></li>
            </ul>
          </aside>
        </div>
        <div class="release-note">
          <strong>IU-002 was absorbed by UX-007.</strong>
          Inactive signed-copy controls no longer render when no pursuit exists, so a
          separate disabled-button treatment would have preserved UI that the product
          no longer needs.
        </div>
        <div class="logic-grid">
          <article><span class="eyebrow">Why now</span><h3>Consolidate after a dense release week</h3><p>New workflows were working, but the milestone needed one consistency pass across hierarchy, reachability and mobile behavior.</p></article>
          <article><span class="eyebrow">What changed</span><h3>Make state and action proportional</h3><p>Primary work is visible first; optional detail and inactive actions recede until they are relevant.</p></article>
          <article><span class="eyebrow">What follows</span><h3>Use the same rules for future work</h3><p>Reachability, progressive disclosure, calm metadata and evidence-backed release QA become reusable product defaults.</p></article>
        </div>
      </section>

      <section class="section" aria-labelledby="product-update-evidence">
        <div class="proof-intro">
          <div>
            <span class="eyebrow">Released product evidence</span>
            <h2 id="product-update-evidence">Eight before / now stories</h2>
            <p>Every update keeps the same reading order: visual evidence first, then the change, its value and the completed verification.</p>
          </div>
          <div class="proof-count">Production build 10.124e177</div>
        </div>
        ${productUpdateCards}
      </section>

      <section class="section" aria-labelledby="product-update-close">
        <div class="decision-section">
          <span class="eyebrow">Release boundary</span>
          <h2 id="product-update-close">A usability release, not a change to the operating contract.</h2>
          <p>No product data model, confidentiality access rule or server action was loosened. UX-003 clarifies the real gate; UX-007 changes inactive presentation while retaining evidence and active-pursuit semantics.</p>
        </div>
        <div class="report-meta">
          <span><strong>Feature release:</strong> 124e177 · build 10.124e177</span>
          <span><strong>Report release:</strong> 4dadf68</span>
          <span><strong>Evidence:</strong> production desktop and 390 px mobile QA</span>
          <span><strong>Mutations:</strong> none during report verification</span>
          <span><strong>Status:</strong> Prepared, not sent</span>
        </div>
      </section>
    </main>
`

const strategyCss = `
  .strategy-principles {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .strategy-principles li {
    padding: 14px 0;
    border-top: 1px solid #d8dee8;
  }
  .strategy-principles li:first-child {
    border-top: 0;
    padding-top: 0;
  }
  .strategy-principles strong {
    display: block;
    margin-bottom: 3px;
    color: #182230;
  }
  .status-segment.review {
    width: 5.714%;
    min-width: 88px;
    background: #fff1d6;
    color: #765000;
  }
  .status-segment.planned {
    width: 30%;
    background: #e9edf3;
    color: #405066;
  }
  .status-segment.delivered {
    width: 64.286%;
    background: #dff2ed;
    color: #155d55;
  }
  .strategy-arc {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: 28px;
  }
  .strategy-step {
    padding: 22px;
    border: 1px solid #d8dee8;
    border-radius: 12px;
    background: #fff;
  }
  .strategy-step .step-number {
    display: block;
    margin-bottom: 28px;
    color: #146c68;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .1em;
  }
  .strategy-step h3 {
    margin: 0 0 10px;
    font-size: 18px;
  }
  .strategy-step p {
    margin: 0;
    color: #5f6b7a;
    font-size: 14px;
    line-height: 1.6;
  }
  .strategy-step small {
    display: block;
    margin-top: 18px;
    color: #7a8797;
    line-height: 1.5;
  }
  .evidence-mosaic {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-top: 28px;
  }
  .evidence-mosaic figure {
    margin: 0;
    overflow: hidden;
    border: 1px solid #d8dee8;
    border-radius: 12px;
    background: #f7f9fb;
  }
  .evidence-mosaic img {
    display: block;
    width: 100%;
    height: 330px;
    object-fit: contain;
    object-position: top;
  }
  .evidence-mosaic figcaption {
    padding: 14px 16px 16px;
    border-top: 1px solid #d8dee8;
    background: #fff;
    color: #5f6b7a;
    font-size: 12px;
    line-height: 1.55;
  }
  .evidence-mosaic strong {
    display: block;
    margin-bottom: 3px;
    color: #182230;
    font-size: 13px;
  }
  .sequence {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-top: 26px;
    border: 1px solid #d8dee8;
    border-radius: 12px;
    overflow: hidden;
  }
  .sequence article {
    position: relative;
    padding: 22px;
    background: #fff;
  }
  .sequence article + article {
    border-left: 1px solid #d8dee8;
  }
  .sequence span {
    display: block;
    margin-bottom: 20px;
    color: #146c68;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .11em;
    text-transform: uppercase;
  }
  .sequence strong {
    display: block;
    margin-bottom: 8px;
    color: #182230;
  }
  .sequence p {
    margin: 0;
    color: #5f6b7a;
    font-size: 13px;
    line-height: 1.55;
  }
  .milestone-list {
    display: grid;
    gap: 12px;
    margin-top: 26px;
  }
  .milestone {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr) 220px;
    gap: 20px;
    align-items: start;
    padding: 20px;
    border: 1px solid #d8dee8;
    border-radius: 12px;
    background: #fff;
  }
  .milestone-date {
    color: #146c68;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .milestone h3 {
    margin: 0 0 7px;
    font-size: 17px;
  }
  .milestone p {
    margin: 0;
    color: #5f6b7a;
    font-size: 13px;
    line-height: 1.55;
  }
  .milestone p + p {
    margin-top: 10px;
  }
  .milestone-state {
    padding-left: 18px;
    border-left: 1px solid #d8dee8;
    color: #4b5969;
    font-size: 12px;
    line-height: 1.55;
  }
  .milestone-state strong {
    display: block;
    margin-bottom: 4px;
    color: #182230;
  }
  .truth-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-top: 26px;
  }
  .truth-panel {
    padding: 24px;
    border: 1px solid #d8dee8;
    border-radius: 12px;
  }
  .truth-panel.true {
    background: #f0f8f6;
    border-color: #bddfd6;
  }
  .truth-panel.open {
    background: #fff9ed;
    border-color: #efd9a8;
  }
  .truth-panel h3 {
    margin: 0 0 14px;
  }
  .truth-panel ul {
    margin: 0;
    padding-left: 18px;
  }
  .truth-panel li {
    margin: 9px 0;
    color: #4b5969;
    line-height: 1.55;
  }
  .cutover-warning {
    margin-top: 22px;
    padding: 24px;
    border: 1px solid #e7c37b;
    border-radius: 12px;
    background: #fff7e6;
  }
  .cutover-warning .eyebrow {
    color: #8a5c00;
  }
  .cutover-warning h3 {
    margin: 8px 0 10px;
  }
  .cutover-warning p {
    margin: 8px 0 0;
    color: #5f4b27;
    line-height: 1.65;
  }
  .gate-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    margin-top: 24px;
  }
  .gate {
    padding: 22px;
    border: 1px solid #d8dee8;
    border-radius: 12px;
    background: #fff;
  }
  .gate-code {
    display: inline-block;
    margin-bottom: 14px;
    color: #146c68;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .1em;
    text-transform: uppercase;
  }
  .gate h3 {
    margin: 0 0 8px;
    font-size: 17px;
  }
  .gate p {
    margin: 0;
    color: #5f6b7a;
    font-size: 13px;
    line-height: 1.6;
  }
  .gate p + p {
    margin-top: 10px;
  }
  .next-sequence {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin-top: 24px;
  }
  .next-sequence article {
    padding: 24px;
    border: 1px solid #d8dee8;
    border-radius: 12px;
    background: #fff;
  }
  .next-sequence span {
    display: block;
    margin-bottom: 20px;
    color: #146c68;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .1em;
    text-transform: uppercase;
  }
  .next-sequence h3 {
    margin: 0 0 10px;
  }
  .next-sequence p {
    margin: 0;
    color: #5f6b7a;
    line-height: 1.6;
  }
  .success-close {
    padding: 34px;
    border-radius: 14px;
    background: #081020;
    color: #fff;
  }
  .success-close .eyebrow {
    color: #9ec7bd;
  }
  .success-close h2 {
    max-width: 850px;
    margin: 10px 0 14px;
    color: #fff;
  }
  .success-close p {
    max-width: 850px;
    margin: 0;
    color: #cbd3df;
    line-height: 1.7;
  }
  @media (max-width: 900px) {
    .strategy-arc,
    .sequence {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .sequence article:nth-child(3) {
      border-left: 0;
      border-top: 1px solid #d8dee8;
    }
    .sequence article:nth-child(4) {
      border-top: 1px solid #d8dee8;
    }
    .milestone {
      grid-template-columns: 80px minmax(0, 1fr);
    }
    .milestone-state {
      grid-column: 2;
      padding: 14px 0 0;
      border-top: 1px solid #d8dee8;
      border-left: 0;
    }
  }
  @media (max-width: 700px) {
    .strategy-arc,
    .sequence,
    .evidence-mosaic,
    .truth-grid,
    .gate-grid,
    .next-sequence {
      grid-template-columns: 1fr;
    }
    .sequence article + article,
    .sequence article:nth-child(3) {
      border-top: 1px solid #d8dee8;
      border-left: 0;
    }
    .milestone {
      grid-template-columns: 1fr;
    }
    .milestone-state {
      grid-column: auto;
    }
    .evidence-mosaic img {
      height: 250px;
    }
  }
`

const strategyBody = `
    <main class="report">
      <header class="hero">
        ${brand("Founder reporting · Monthly CTO update · July 2026")}
        <h1>July made WAVE clearer and safer to operate. August is about testing and refining it through real use.</h1>
        <p class="hero-lede">
          This is my first monthly product update as CTO. I have kept it focused on
          four questions: what changed for the people using WAVE, why the work mattered,
          how it advances the agreed milestones, and where founder or operating input
          is now needed.
        </p>
        <div class="runway" aria-label="July monthly update summary">
          <article><span class="runway-label">01 · What changed</span><strong>A more dependable core workflow</strong><small>Staff records, repreneur actions and confidentiality states are clearer</small></article>
          <article><span class="runway-label">02 · Main milestone</span><strong>The technical opportunity foundation is complete</strong><small>Cutover and post-cutover reconciliation are complete; operating proof remains</small></article>
          <article><span class="runway-label">03 · August focus</span><strong>Test, refine, then widen</strong><small>One reminder UAT and ten working days of WAVE-only staff operation</small></article>
        </div>
      </header>

      <section class="section" aria-labelledby="monthly-position">
        <div class="executive">
          <div class="executive-copy">
            <span class="eyebrow">A note from the CTO</span>
            <h2 id="monthly-position">This month was about making WAVE dependable before asking it to carry more of the business.</h2>
            <p>
              I joined during a dense period of product activity. The sensible first
              step was not to add another layer of features. It was to make the existing
              product easier to understand, safer to use and more consistent with the
              way Re-New wants to operate.
            </p>
            <p>
              Staff can now work from a stronger relationship and opportunity record.
              Repreneurs have clearer, bounded ways to assess and respond to deals.
              Confidentiality and document states are more explicit. The 28 July
              workbook cutover and the one-time post-cutover reconciliation are now
              complete, with WAVE owning future corrections and activity. Titleless
              opportunities remain safely staff-only and ambiguous identities remain
              explicit rather than guessed.
            </p>
            <p>
              That is meaningful foundation work, but it is not yet a measured business
              outcome. The next phase is to test and refine the operating model through
              real use: one reminder UAT and ten working days in which the team operates
              opportunities only in WAVE, correcting issues as real work exposes them.
            </p>
          </div>
          <aside aria-label="Month-end position">
            <span class="eyebrow">Position at month end</span>
            <ul class="strategy-principles">
              <li><strong>Released</strong>Production cutover, post-cutover reconciliation and the core operating foundation.</li>
              <li><strong>M1 proof open</strong>One reminder UAT and ten working days of WAVE-only staff operation.</li>
              <li><strong>M2 planned</strong>Prove the complete repreneur stack with 3–5 beta users, refine it, then open it to all eligible current repreneurs.</li>
              <li><strong>Measurement open</strong>The north-star KPI still needs a real baseline.</li>
            </ul>
          </aside>
        </div>
        <div class="source-note">
          <strong>Delivery context, not an outcome score:</strong> M1’s technical work
          is complete, but the milestone remains open until the two operating proofs
          pass. M2 and M3 remain planned. Delivery activity does not by itself prove
          adoption, customer value or additional operating capacity.
        </div>
      </section>

      <section class="section" aria-labelledby="user-outcomes">
        <div class="proof-intro">
          <div>
            <span class="eyebrow">What changed for Re-New</span>
            <h2 id="user-outcomes">Four practical outcomes from the July work</h2>
            <p>Each outcome is described from the user or founder point of view, with its strategic connection and current evidence limit.</p>
          </div>
          <div class="proof-count">Users first · implementation second</div>
        </div>

        <div class="strategy-arc">
          <article class="strategy-step"><span class="step-number">STAFF</span><h3>One clearer relationship workspace</h3><p>Firms, contacts, opportunity context and relationship history are easier to reach and update without creating accidental work.</p><small><strong>Why it matters:</strong> fewer hand-off gaps and a stronger basis for follow-up. This now supports M1’s real-use operating proof.</small></article>
          <article class="strategy-step"><span class="step-number">REPRENEURS</span><h3>A more understandable deal journey</h3><p>Repreneurs can scan a controlled shortlist, review appropriate deal facts and respond through deliberate interest or decline paths.</p><small><strong>Why it matters:</strong> structured participation replaces inbox ambiguity while staff-only context stays private. This is part of the complete M2 stack that moves from beta to all eligible current repreneurs.</small></article>
          <article class="strategy-step"><span class="step-number">BOTH AUDIENCES</span><h3>Confidentiality states explain the real gate</h3><p>Users see why a document is locked and what legitimate condition comes next; staff retain the evidence behind that state.</p><small><strong>Why it matters:</strong> useful visibility can expand without weakening intermediary confidence. NDA and lifecycle control are part of M2, not a separate milestone.</small></article>
          <article class="strategy-step"><span class="step-number">FOUNDERS</span><h3>One governed opportunity record</h3><p>The production workbook snapshot and its post-cutover reconciliation are complete in WAVE.</p><small><strong>Why it matters:</strong> future corrections and activity can happen in one system. The remaining M1 question is sustained operating use, not technical availability or data cleanup.</small></article>
        </div>

        <div class="evidence-mosaic" aria-label="July WAVE product evidence">
          <figure><img src="${imageFor("UX-001 after release in production")}" alt="Production Relationships firms view" loading="lazy" /><figcaption><strong>Staff relationship work</strong>Canonical firms and contacts are reachable from the Relationships workspace. Evidence: released desktop and mobile QA; time saved is not yet measured.</figcaption></figure>
          <figure><img src="${imageFor("UX-002 after release in production")}" alt="Production repreneur deal shortlist" loading="lazy" /><figcaption><strong>Repreneur deal assessment</strong>A compact shortlist exposes appropriate deal facts while keeping internal scoring and staff evidence private. Adoption and commercial usefulness still need measurement.</figcaption></figure>
          <figure><img src="${imageFor("UX-003 after release in production")}" alt="Production confidentiality memo lock" loading="lazy" /><figcaption><strong>Clearer document conditions</strong>The product communicates the signed-or-waived and approval conditions without exposing confidential metadata.</figcaption></figure>
          <figure><img src="${imageFor("UX-007 after release in production")}" alt="Production staff NDA artifact state" loading="lazy" /><figcaption><strong>Retained staff evidence</strong>NDA artifacts and history remain available while inactive actions stay out of the way. Wider lifecycle communication still depends on the open UAT gates.</figcaption></figure>
        </div>
      </section>

      <section class="section" aria-labelledby="strategy-connection">
        <div class="executive">
          <div class="executive-copy">
            <span class="eyebrow">Connection to the PDR strategy</span>
            <h2 id="strategy-connection">The goal is more active pursuits without proportionally more coordination.</h2>
            <p>
              The live PDR’s stated ambition is to move from 17 to 100+ active repreneurs and from
              approximately 100 to 200+ opportunities without degrading service quality
              or inflating headcount. Its north-star KPI is
              <strong>active pursuits per operations FTE</strong>.
            </p>
            <p>
              July’s work supports that goal by reducing ambiguity in records, actions
              and permissions. It does not yet prove the result. Baseline, current and
              target values for the KPI are still unset, so I will not present the
              scale ambition as achieved impact.
            </p>
          </div>
          <aside aria-label="Strategy guardrails">
            <span class="eyebrow">How the sequence protects the goal</span>
            <ul class="strategy-principles">
              <li><strong>One record first</strong>Reduce duplicate coordination before adding more participants.</li>
              <li><strong>Authority before automation</strong>Set disclosure and lifecycle rules before scaling matching or communication.</li>
              <li><strong>Staff proof before wider access</strong>Prove the internal operating rhythm before the complete repreneur stack expands beyond beta.</li>
              <li><strong>Measure before claiming scale</strong>Establish the capacity baseline before comparing performance.</li>
            </ul>
          </aside>
        </div>

        <div class="sequence">
          <article><span>01 · Operate and refine</span><strong>Close M1 through real use</strong><p>Staff prove that active, paused and new opportunities stay current in WAVE, while issues found in real work are corrected.</p></article>
          <article><span>02 · Beta then widen</span><strong>Complete the repreneur stack</strong><p>Three to five repreneurs test the full controlled flow; defects are corrected before the same stack opens to every eligible current repreneur.</p></article>
          <article><span>03 · Improve from evidence</span><strong>Optimise matching and pursuit</strong><p>Representative live outcomes guide later matching calibration and better pursuit selection.</p></article>
        </div>
      </section>

      <section class="section" aria-labelledby="roadmap-position">
        <div class="proof-intro">
          <div>
            <span class="eyebrow">Milestone connection</span>
            <h2 id="roadmap-position">The three milestones now form one practical progression.</h2>
            <p>The status below separates released capability, operating proof, founder input and later product work.</p>
          </div>
          <div class="proof-count">Jul–Aug → Aug–Sep → Oct–Nov</div>
        </div>

        <div class="milestone-list">
          <article class="milestone"><div class="milestone-date">Target 31 Aug</div><div><h3>WAVE is the sole authoritative system for in-scope opportunities</h3><p>The production cutover and post-cutover reconciliation are complete. WAVE owns corrections and future activity. The remaining M1 work is one Bertrand reminder UAT and a ten-working-day WAVE-only operating observation led by Colin.</p></div><div class="milestone-state"><strong>In progress; technical work complete</strong>M1 closes when the two real-use proofs pass, not merely because the target date arrives. Issues found during the window are refined in WAVE, with no operational Excel edits. <small>Tracking: W-007 and W-013.</small></div></article>
          <article class="milestone"><div class="milestone-date">Target 30 Sep</div><div><h3>The complete repreneur deal-flow stack is proven in beta and opened to all eligible current repreneurs</h3><p>Three to five beta repreneurs test role-safe access, opportunity discovery, interest or decline, staff validation, lifecycle control, NDA handling and gated document access as one stack.</p><p>What real use reveals is corrected before the same stack is opened to every eligible current repreneur. Beta is the proving phase, not the milestone destination.</p></div><div class="milestone-state"><strong>Planned; delivery health not yet proven</strong>M2 build and preparation may progress in parallel, but beta-to-all expansion waits for stable M1 operating proof. Matching v2 is not a prerequisite.</div></article>
          <article class="milestone"><div class="milestone-date">Target 30 Nov</div><div><h3>Evidence-led matching and pursuit optimisation improves the live deal-flow stack</h3><p>Representative outcomes from staff and repreneur use guide matching calibration and better pursuit selection without making numeric scoring a prerequisite for the controlled operating flow.</p></div><div class="milestone-state"><strong>Planned; begins from live evidence</strong>KPI, freshness and performance evidence remain cross-cutting proof, not a separate December milestone.</div></article>
        </div>
      </section>

      <section class="section" aria-labelledby="truth-boundary">
        <span class="eyebrow">Truth boundary</span>
        <h2 id="truth-boundary">What is complete, and what I still need to prove.</h2>
        <div class="truth-grid">
          <article class="truth-panel true"><h3>Complete or evidenced</h3><ul><li>The production workbook cutover and post-cutover reconciliation are complete.</li><li>WAVE owns future corrections and activity for the imported snapshot.</li><li>Titleless opportunities remain Draft and staff-only; ambiguous identities remain explicit rather than guessed.</li><li>The canonical relationship workspace and staff/repreneur visibility boundaries are live.</li><li>The repreneur journey supports bounded discovery, interest, decline and document states.</li></ul></article>
          <article class="truth-panel open"><h3>Open proof or input</h3><ul><li>Bertrand’s one-session reminder UAT.</li><li>Ten working days of WAVE-only staff operation led by Colin, with no operational Excel edits.</li><li>A real baseline for active pursuits per operations FTE.</li><li>M2 lifecycle, source-visibility, communication and confidentiality UAT.</li><li>The beta-to-all rollout and evidence needed before any scale claim.</li></ul></article>
        </div>
        <div class="cutover-warning">
          <span class="eyebrow">Current release boundary</span>
          <h3>Technical reconciliation does not close the operating milestone by itself.</h3>
          <p>W-071 closes the bounded post-cutover data work. M1 remains open until W-007 and W-013 prove that reminders behave correctly and staff actually operate opportunities only in WAVE.</p>
          <p><strong>Management implication:</strong> the immediate phase is testing and refinement through real use, not another feature-counting exercise.</p>
        </div>
      </section>

      <section class="section" aria-labelledby="founder-inputs">
        <div class="proof-intro">
          <div>
            <span class="eyebrow">Founder and operating inputs</span>
            <h2 id="founder-inputs">Two operating proofs close M1; later inputs prepare M2.</h2>
            <p>These are written as management actions rather than engineering cards. The PDR references remain only for traceability.</p>
          </div>
          <div class="proof-count">Recommendation · owner · unlock</div>
        </div>
        <div class="gate-grid">
          <article class="gate"><span class="gate-code">Operating validation · owner Bertrand · M1 gate</span><h3>Complete one reminder UAT session</h3><p><strong>Request:</strong> verify one five-business-day stall, one 90-day candidate-stale record and one 30-day source re-check in safe synthetic context.</p><p><strong>Recommendation:</strong> keep every timer explainable, visible to staff and unable to close work automatically.</p><p><strong>Unlock:</strong> W-007 and the freshness part of M1 operating proof.</p></article>
          <article class="gate"><span class="gate-code">Real-use observation · owner Colin · Bertrand co-assignee · M1 gate</span><h3>Operate opportunities only in WAVE for ten working days</h3><p><strong>Request:</strong> record active, paused and new-opportunity work in WAVE, keep follow-up visible and make no operational Excel edits during the agreed window.</p><p><strong>Recommendation:</strong> correct product or process issues as real work reveals them rather than creating a parallel manual queue.</p><p><strong>Unlock:</strong> W-013 and closure of M1.</p></article>
          <article class="gate"><span class="gate-code">M2 readiness · owners Bertrand + Colin · separate from M1</span><h3>Close lifecycle, source-visibility and communication gates</h3><p><strong>Request:</strong> validate who sees which source information, the NDA trigger, actor transitions and the French communication flow before wider repreneur use.</p><p><strong>Recommendation:</strong> treat these as M2 stack gates, not reasons to keep M1’s technical foundation open.</p><p><strong>Unlock:</strong> a safe and testable 3–5 repreneur beta.</p></article>
        </div>
        <div class="source-note">
          <strong>Sequencing boundary:</strong> M2 build and preparation can continue
          while M1 is observed, but expansion from beta to all eligible repreneurs
          remains gated on stable WAVE-only operations and the M2 confidentiality,
          lifecycle and source-visibility proof.
        </div>
      </section>

      <section class="section" aria-labelledby="august-proof">
        <span class="eyebrow">What I will report next month</span>
        <h2 id="august-proof">August should test and refine WAVE through real use, not return another feature count.</h2>
        <div class="strategy-arc">
          <article class="strategy-step"><span class="step-number">USE</span><h3>WAVE-only operation</h3><p>Evidence that active, paused and new opportunities are updated in WAVE, with no operational Excel edits after cutover.</p><small>Source: staff update log and cutover confirmation.</small></article>
          <article class="strategy-step"><span class="step-number">FRESHNESS</span><h3>Explainable follow-up</h3><p>Evidence that agreed timers surface once, create a visible staff action and never close an opportunity automatically.</p><small>Source: freshness review and W-007 UAT.</small></article>
          <article class="strategy-step"><span class="step-number">REFINE</span><h3>Fix what real work reveals</h3><p>Product and process issues discovered during the observation window are corrected in WAVE rather than worked around in a shadow process.</p><small>Source: W-013 observation and owned defect record.</small></article>
          <article class="strategy-step"><span class="step-number">READY</span><h3>Prepare the complete M2 beta</h3><p>Confirm that lifecycle, confidentiality, source visibility and communication are safe enough for 3–5 repreneurs to test the whole stack.</p><small>Source: M2 UAT and operating decisions.</small></article>
        </div>

        <div class="next-sequence">
          <article><span>Prove</span><h3>Close M1 through real use</h3><p>Complete W-007 and the ten-working-day W-013 window, correcting issues as they appear.</p></article>
          <article><span>Beta</span><h3>Test the complete repreneur stack</h3><p>Use 3–5 repreneurs to test the whole controlled deal-flow experience, not a partial pilot.</p></article>
          <article><span>Widen</span><h3>Open the proven stack to all</h3><p>Correct the beta findings, then extend the same stack to every eligible current repreneur.</p></article>
        </div>
      </section>

      <section class="section">
        <div class="success-close">
          <span class="eyebrow">CTO commitment for August</span>
          <h2>Return with evidence of what real use proved and what it forced us to improve.</h2>
          <p>I will report whether staff operated opportunities only in WAVE, whether reminders behaved correctly, which product or process issues were refined, and whether the complete M2 stack is genuinely ready for beta. No all-repreneur scale claim will be made before beta proof exists.</p>
        </div>
        <div class="source-note">
          <strong>Evidence boundary:</strong> WAVE Strategic PDR and current W-010/W-071
          evidence reviewed on 31 July 2026, together with the canonical M&amp;A data
          contract, tracked release history and production UI/UX evidence. W-071 is
          treated as complete in this draft on the CTO’s confirmation; its final live
          PDR and production proof must be present before distribution. The milestone
          dates are targets, while unbaselined KPI and beta outcomes remain hypotheses
          to test. No commercial, fundraising or negotiation claims are included.
        </div>
        <div class="report-meta">
          <span><strong>PDR position:</strong> 3 active milestones · M1 in progress · M2 and M3 planned</span>
          <span><strong>M1 technical evidence:</strong> W-010 cutover and W-071 reconciliation complete</span>
          <span><strong>July UI/UX evidence:</strong> 124e177 · build 10.124e177</span>
          <span><strong>Updated:</strong> 31 July 2026</span>
          <span><strong>Status:</strong> founder-ready draft · not sent</span>
        </div>
      </section>
    </main>
`

await fs.mkdir(outputDirectory, { recursive: true })
await Promise.all([
  fs.writeFile(
    outputs.ui,
    normalizeHistoricalReport({
      source: uiSource,
      status: "Sent to founders on 14 July 2026",
      continuity:
        "Historical report. The security chapter referenced below was prepared separately on 14 July and remains held, not sent.",
    }),
  ),
  fs.writeFile(
    outputs.security,
    normalizeHistoricalReport({
      source: securitySource,
      status: "Held, not sent",
      continuity:
        "Prepared on 14 July 2026 as a dated account of the closed security cohort and continuing operating cadence.",
    }),
  ),
  fs.writeFile(
    outputs.productUpdates,
    page({
      title: "WAVE founder reporting — Product updates",
      body: productUpdateBody,
      customCss: productUpdateCss,
    }),
  ),
  fs.writeFile(
    outputs.productStrategy,
    page({
      title: "WAVE founder reporting — July monthly CTO update",
      body: strategyBody,
      customCss: strategyCss,
    }),
  ),
])

for (const [key, outputPath] of Object.entries(outputs)) {
  const stat = await fs.stat(outputPath)
  console.log(`${key}: ${path.relative(projectRoot, outputPath)} (${stat.size} bytes)`)
}

const generated = Object.fromEntries(
  await Promise.all(
    Object.entries(outputs).map(async ([key, outputPath]) => [
      key,
      await fs.readFile(outputPath, "utf8"),
    ]),
  ),
)

const assert = (condition, message) => {
  if (!condition) throw new Error(`Founder report validation failed: ${message}`)
}

for (const [key, html] of Object.entries(generated)) {
  assert(/<!doctype html>/i.test(html), `${key} is missing an HTML doctype`)
  assert(/<meta name="viewport"/i.test(html), `${key} is missing viewport metadata`)
  assert(!/<script\b/i.test(html), `${key} contains custom JavaScript`)
  assert(!/\son[a-z]+\s*=/i.test(html), `${key} contains an inline event handler`)
  assert(!/javascript\s*:/i.test(html), `${key} contains a javascript URL`)

  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0])
  for (const imageTag of imageTags) {
    assert(/\balt="[^"]*"/i.test(imageTag), `${key} contains an image without alt text`)
    assert(
      /\bsrc="data:image\//i.test(imageTag),
      `${key} contains a non-embedded image`,
    )
  }

  const ids = [...html.matchAll(/\bid="([^"]+)"/gi)].map((match) => match[1])
  assert(
    new Set(ids).size === ids.length,
    `${key} contains duplicate element IDs`,
  )
}

for (const key of ["productUpdates", "productStrategy"]) {
  const html = generated[key]
  for (const tag of [
    "main",
    "header",
    "section",
    "article",
    "figure",
    "figcaption",
    "aside",
    "div",
    "span",
    "p",
    "h1",
    "h2",
    "h3",
    "ul",
    "li",
  ]) {
    const opens = (html.match(new RegExp(`<${tag}(?:\\s|>)`, "gi")) ?? [])
      .length
    const closes = (html.match(new RegExp(`</${tag}>`, "gi")) ?? []).length
    assert(opens === closes, `${key} has unbalanced <${tag}> elements`)
  }
}

assert(
  (generated.productUpdates.match(/class="story update-story"/g) ?? []).length === 8,
  "product update report must contain eight released update stories",
)
assert(
  (generated.productUpdates.match(/class="comparison"/g) ?? []).length === 8,
  "product update report must contain eight before/production comparisons",
)
assert(
  (generated.productUpdates.match(/Original production state/g) ?? []).length === 8 &&
    (generated.productUpdates.match(/Now in production/g) ?? []).length === 8,
  "product update report must contain sixteen labelled evidence images",
)
assert(
  generated.productUpdates.includes(
    "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);",
  ),
  "product update report must retain a strict two-column comparison",
)
assert(
  generated.productUpdates.includes("IU-002 was absorbed by UX-007"),
  "product update report must explain why IU-002 was removed",
)
assert(
  generated.ui.includes("Sent to founders on 14 July 2026") &&
    generated.security.includes("Held, not sent") &&
    generated.productUpdates.includes("Prepared, not sent"),
  "every portable historical or update report must retain its delivery status",
)

for (const requiredText of [
  "3 active milestones · M1 in progress · M2 and M3 planned",
  "This is my first monthly product update as CTO.",
  "post-cutover reconciliation are now",
  "active pursuits per operations FTE",
  "Tracking: W-007 and W-013.",
  "Beta is the proving phase, not the milestone destination.",
  "ten working days",
  "August should test and refine WAVE through real use",
  "No all-repreneur scale claim will be made before beta proof exists.",
  "founder-ready draft · not sent",
]) {
  assert(
    generated.productStrategy.includes(requiredText),
    `product strategy report is missing: ${requiredText}`,
  )
}

assert(
  (generated.productStrategy.match(/class="milestone"/g) ?? []).length === 3,
  "product strategy report must contain exactly three current milestones",
)
assert(
  !generated.productStrategy.includes("The four milestones") &&
    !generated.productStrategy.includes("31 Dec"),
  "product strategy report must not retain the retired fourth milestone",
)

console.log("Validated: four self-contained, no-script founder reports.")
