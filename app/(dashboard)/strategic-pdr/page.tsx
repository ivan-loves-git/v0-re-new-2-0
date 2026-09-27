import Link from "next/link";
import { connection } from "next/server";
import { ExternalLink, FileText, Inbox, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaffAccess } from "@/lib/access-control";
import { type GovernanceProvenance, type SafeGovernanceIssue } from "@/lib/governance-projection/model";
import { isGovernanceProjectionStale } from "@/lib/governance-projection/freshness";
import { readCurrentGovernanceProjection } from "@/lib/governance-projection/server";
import { childProgress, summarizeFounderWork } from "@/lib/governance-projection/founder-summary";
import { listHistoricalPdrWorkCards, listPdrRequestHistory } from "@/lib/pdr/intake-server";
import { parseHistoricalWorkCardReference, resolveHistoricalWorkCardReference } from "@/lib/pdr/historical-card-reference";
import { redirect } from "next/navigation";

const GOVERNANCE_PROJECT_URL = "https://github.com/orgs/re-new-team/projects/1";

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

function deliveryTone(status: SafeGovernanceIssue["projectStatus"]) {
  if (status === "Done" || status === "Cancelled / Superseded") return "secondary" as const;
  if (status === "Review") return "outline" as const;
  return "default" as const;
}

function IssueActions({ issue }: { issue: SafeGovernanceIssue }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline">
        <a href={issue.url} target="_blank" rel="noreferrer">
          Open / Discuss in GitHub <ExternalLink className="size-3.5" />
        </a>
      </Button>
    </div>
  );
}

function ProvenanceSummary({ provenance }: { provenance: GovernanceProvenance | undefined }) {
  if (provenance?.state === "direct_github") return <p className="text-sm text-muted-foreground">Direct GitHub scope. No PDR source is expected.</p>;
  if (provenance?.state === "pdr_work_card") return <p className="text-sm text-muted-foreground">{provenance.publication === "direct-github" ? `Direct GitHub scope, with verified historical PDR Work Card ${provenance.pdrReference} context.` : `Verified PDR historical Work Card ${provenance.pdrReference}.`}</p>;
  if (provenance?.state === "pdr_strategic_item") return <p className="text-sm text-muted-foreground">{provenance.publication === "direct-github" ? "Direct GitHub scope, with verified PDR strategic-item context. No internal detail route exists for it yet." : "Verified PDR strategic-item metadata is recorded, but no internal detail route exists for it yet."}</p>;
  return <p className="text-sm text-muted-foreground">Source provenance is unavailable or unverified in the governance projection.</p>;
}

function ProductChangeTitle({ issue }: { issue: SafeGovernanceIssue }) {
  if (issue.provenance?.state === "pdr_work_card" && issue.provenance.pdrWorkCardId) {
    return <h3 className="font-medium leading-snug"><Link className="inline-flex items-center gap-1 underline underline-offset-4" href={`/strategic-pdr/work-cards/${issue.provenance.pdrWorkCardId}`}>{issue.title}<FileText className="size-3.5" /></Link></h3>;
  }
  return <h3 className="font-medium leading-snug">{issue.title}</h3>;
}

function ProductChangeOutcome({ issue }: { issue: SafeGovernanceIssue }) {
  const reporting = issue.reporting;
  const disposition = reporting?.closureDisposition;
  const release = reporting?.release;
  const state = disposition === "completed"
    ? release?.state === "verified" ? `Completed scope · verified in production ${displayDate(release.verifiedAt)}`
      : release?.state === "not_released" ? "Completed scope · not released to production"
      : "Completed scope · production release unverified"
    : disposition === "cancelled" ? "Cancelled scope"
    : disposition === "superseded" ? "Superseded scope"
    : issue.state === "OPEN" ? release?.state === "verified" ? "Scope open · earlier production release verified" : "Scope open"
    : "Closure outcome unverified";
  return <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
    <p className="font-medium">{state}</p>
    {reporting?.founderSummary ? <p>{reporting.founderSummary.text}</p>
      : release?.state === "verified" ? <p className="text-muted-foreground">An approved founder summary is not recorded for this release.</p>
      : null}
  </div>;
}

function ProductChangeCard({ issue, linkedIssues }: { issue: SafeGovernanceIssue; linkedIssues: SafeGovernanceIssue[] }) {
  const progress = childProgress(issue, linkedIssues);
  return (
    <article className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={deliveryTone(issue.projectStatus)}>{issue.projectStatus}</Badge>
            <span className="wave-micro-label">Product Change #{issue.number}</span>
          </div>
          <ProductChangeTitle issue={issue} />
          <ProvenanceSummary provenance={issue.provenance} />
        </div>
        <IssueActions issue={issue} />
      </div>
      <ProductChangeOutcome issue={issue} />
      <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="wave-micro-label">Owner</dt><dd>{issue.assigneeLogins.length ? issue.assigneeLogins.join(", ") : "Unassigned"}</dd></div>
        <div><dt className="wave-micro-label">Dependencies</dt><dd>{issue.dependencyNumbers.length ? issue.dependencyNumbers.map((item) => `#${item}`).join(", ") : "None recorded"}</dd></div>
        <div><dt className="wave-micro-label">Child progress</dt><dd>{progress.total ? `${progress.done} of ${progress.total} Tickets/Bugs done` : "No linked Tickets/Bugs"}</dd></div>
        <div><dt className="wave-micro-label">Scope closed</dt><dd>{issue.reporting?.closedAt ? displayDate(issue.reporting.closedAt) : issue.state === "CLOSED" ? "Date unverified" : "Open"}</dd></div>
      </dl>
      {linkedIssues.length ? (
        <div className="border-t pt-3">
          <p className="wave-micro-label mb-2">Ticket and Bug detail</p>
          <ul className="space-y-2 text-sm">
            {linkedIssues.map((child) => (
              <li key={child.number} className="flex flex-wrap items-center justify-between gap-2">
                <span><Badge variant={deliveryTone(child.projectStatus)} className="mr-2">{child.projectStatus}</Badge>#{child.number} · {child.title}</span>
                <a className="inline-flex items-center gap-1 underline underline-offset-4" href={child.url} target="_blank" rel="noreferrer">Discuss <ExternalLink className="size-3" /></a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export default async function StrategicPdrPage({ searchParams }: { searchParams: Promise<{ card?: string | string[] }> }) {
  await connection();
  await requireStaffAccess();
  const legacyCardQuery = (await searchParams).card;
  const legacyReference = parseHistoricalWorkCardReference(legacyCardQuery);
  const legacyCard = legacyReference === null
    ? null
    : await listHistoricalPdrWorkCards()
      .then((cards) => resolveHistoricalWorkCardReference(legacyReference, cards))
      .catch(() => null);
  if (legacyCard) redirect(`/strategic-pdr/work-cards/${legacyCard.id}`);
  const [current, requestResult] = await Promise.all([
    readCurrentGovernanceProjection(),
    listPdrRequestHistory().then((requests) => ({ state: "available" as const, requests })).catch(() => ({ state: "unavailable" as const, requests: [] })),
  ]);

  if (current.state === "unavailable") {
    return <div className="space-y-6"><header className="space-y-2"><p className="wave-micro-label">Strategic PDR</p><h1 className="text-2xl font-semibold">Strategy, delivery and requests</h1></header><Card className="border-destructive/40"><CardHeader><CardTitle>Governance projection unavailable</CardTitle><CardDescription>GitHub is the delivery authority. Its last validated projection is not available in WAVE, so no strategy or delivery relationship is shown.</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><a href={GOVERNANCE_PROJECT_URL} target="_blank" rel="noreferrer">Open GitHub delivery board <ExternalLink className="size-3.5" /></a></Button></CardContent></Card></div>;
  }

  const { projection, lastValidatedAt } = current;
  const isStale = isGovernanceProjectionStale(lastValidatedAt);
  const productChanges = projection.issues.filter((issue) => issue.kind === "Product Change");
  const work = summarizeFounderWork(projection);
  const childrenByParent = new Map<number, SafeGovernanceIssue[]>();
  for (const issue of projection.issues) {
    if ((issue.kind === "Ticket" || issue.kind === "Bug") && issue.parentNumber !== null) {
      const children = childrenByParent.get(issue.parentNumber) ?? [];
      children.push(issue);
      childrenByParent.set(issue.parentNumber, children);
    }
  }

  return <div className="space-y-8">
    <header className="space-y-3">
      {legacyCardQuery ? <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">The requested historical record is unavailable. This does not indicate whether a record exists.</p> : null}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-2"><p className="wave-micro-label">Strategic PDR</p><h1 className="text-2xl font-semibold">Strategy, delivery and requests</h1><p className="max-w-3xl text-sm text-muted-foreground">WAVE holds request intake and the readable strategic view. GitHub is the authoritative place for current product decisions, delivery status and discussion.</p></div>
        <Button asChild variant="outline"><a href={GOVERNANCE_PROJECT_URL} target="_blank" rel="noreferrer">Open delivery board <ExternalLink className="size-3.5" /></a></Button>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span>Registry source commit <code>{projection.sourceCommit.slice(0, 12)}</code></span><span>Registry {projection.registryRevision}</span><span>Snapshot created {displayDate(projection.snapshotAt)}</span><span><RefreshCw className="mr-1 inline size-3" />Last successful GitHub validation {displayDate(lastValidatedAt)}</span></div>
      {isStale ? <p className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">This WAVE projection has not been successfully validated against GitHub in more than 24 hours. Check GitHub before making a delivery decision. A failed refresh does not change the last successful validation time above.</p> : null}
    </header>

    <section className="space-y-4" aria-labelledby="strategy-heading">
      <div><p className="wave-micro-label">Strategy</p><h2 id="strategy-heading" className="text-xl font-semibold">Accepted goals and outcomes</h2><p className="text-sm text-muted-foreground">Outcome Milestones and KPI definitions come from the accepted Strategy Registry. Product release does not establish business achievement.</p></div>
      <Card><CardHeader><CardTitle>Completed work in this snapshot</CardTitle><CardDescription>Product Changes are counted once. Ticket and Bug progress appears inside each change.</CardDescription></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><p className="wave-micro-label">Completed scope</p><p className="text-2xl font-semibold">{work.completed}</p></div><div><p className="wave-micro-label">Verified in production</p><p className="text-2xl font-semibold">{work.verifiedProduction}</p></div><div><p className="wave-micro-label">Closed, not released</p><p className="text-2xl font-semibold">{work.closedUnreleased}</p></div><div><p className="wave-micro-label">Closure needs evidence</p><p className="text-2xl font-semibold">{work.unverifiedClosures}</p></div><p className="sm:col-span-2 lg:col-span-4 text-muted-foreground">{work.releaseUnknown} completed scope record{work.releaseUnknown === 1 ? " has" : "s have"} no verified release fact. {work.cancelled} cancelled and {work.superseded} superseded changes are outside completed totals.</p></CardContent></Card>
      <div className="space-y-4">
        {projection.registry.goals.map((goal) => {
          const milestones = projection.registry.milestones.filter((item) => item.goalId === goal.id && item.lifecycle === "active");
          return <Card key={goal.id}><CardHeader><CardTitle>{goal.id} · {goal.title}</CardTitle><CardDescription>{goal.statement}</CardDescription></CardHeader><CardContent className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-2">{goal.kpiIds.map((kpiId) => { const kpi = projection.registry.kpis.find((item) => item.id === kpiId); return kpi ? <div key={kpi.id} className="rounded-md border p-3"><p className="wave-micro-label">{kpi.id} · KPI</p><p className="font-medium">{kpi.title}</p><p className="mt-1 text-sm text-muted-foreground">Definition: {kpi.definitionStatus === "accepted" ? "accepted" : "needs approval"} · Actual: unavailable · {kpi.definitionStatus === "accepted" && kpi.target.status === "accepted" && kpi.target.value !== null ? `Accepted target: ${kpi.target.value} ${kpi.unit}` : kpi.target.status === "proposed" ? "Target proposed, not approved" : "Target unavailable"}</p></div> : null })}</div>
            {milestones.map((milestone) => { const changes = productChanges.filter((item) => item.placement.goalId === goal.id && item.placement.milestoneId === milestone.id); return <div key={milestone.id} className="space-y-3 border-t pt-5"><div><p className="wave-micro-label">Outcome milestone · {milestone.id} · {milestone.outcomeState.replaceAll("_", " ")}</p><h3 className="font-medium">{milestone.title}</h3><p className="text-sm text-muted-foreground">{milestone.outcome}</p></div>{changes.length ? changes.map((issue) => <ProductChangeCard key={issue.number} issue={issue} linkedIssues={childrenByParent.get(issue.number) ?? []} />) : <p className="text-sm text-muted-foreground">No current Product Change is mapped to this milestone in the validated projection.</p>}</div> })}
          </CardContent></Card>
        })}
      </div>
    </section>

    <section className="space-y-4" aria-labelledby="unmapped-heading"><div><p className="wave-micro-label">Delivery</p><h2 id="unmapped-heading" className="text-xl font-semibold">Product Changes without a current strategic placement</h2></div><Card><CardContent className="space-y-3 pt-6">{productChanges.filter((issue) => issue.placement.goalId === null).map((issue) => <ProductChangeCard key={issue.number} issue={issue} linkedIssues={childrenByParent.get(issue.number) ?? []} />)}{!productChanges.some((issue) => issue.placement.goalId === null) ? <p className="text-sm text-muted-foreground">Every current Product Change has a validated strategic placement.</p> : null}</CardContent></Card></section>

    <section aria-labelledby="requests-heading"><Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="wave-micro-label">Requests</p><CardTitle id="requests-heading">Founder and staff intake</CardTitle><CardDescription>Original requests, AI screening and historical evidence stay in WAVE. They do not change GitHub delivery status.</CardDescription></div><Button asChild size="sm"><Link href="/strategic-pdr/requests"><Inbox className="size-3.5" />Open request intake</Link></Button></div></CardHeader><CardContent className="text-sm text-muted-foreground">{requestResult.state === "available" ? `${requestResult.requests.length} request records are available to staff. A request opens as a Product Change only when a verified handoff link is recorded; otherwise it remains intake evidence, not delivery scope.` : "Request history is temporarily unavailable. GitHub delivery data remains separate and is shown above."}</CardContent></Card></section>
  </div>;
}
