import Link from "next/link";
import { connection } from "next/server";
import { ExternalLink, FileText, GitPullRequest, Inbox, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaffAccess } from "@/lib/access-control";
import { type SafeGovernanceIssue } from "@/lib/governance-projection/model";
import { verifiedPdrRequestByGovernanceIssue } from "@/lib/governance-projection/pdr-source";
import { readCurrentGovernanceProjection } from "@/lib/governance-projection/server";
import { listPdrRequestHistory } from "@/lib/pdr/intake-server";

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function deliveryTone(status: SafeGovernanceIssue["projectStatus"]) {
  if (status === "Done") return "secondary" as const;
  if (status === "Review") return "outline" as const;
  return "default" as const;
}

function IssueActions({ issue, pdrRequest }: { issue: SafeGovernanceIssue; pdrRequest?: { id: string; title: string } }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline">
        <a href={issue.url} target="_blank" rel="noreferrer">
          Open / Discuss in GitHub <ExternalLink className="size-3.5" />
        </a>
      </Button>
      {pdrRequest ? (
        <Button asChild size="sm" variant="ghost">
          <Link href={`/strategic-pdr/requests/${pdrRequest.id}`}>
            <FileText className="size-3.5" /> Original PDR request
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function ProductChangeCard({ issue, pdrRequest, children }: { issue: SafeGovernanceIssue; pdrRequest?: { id: string; title: string }; children: SafeGovernanceIssue[] }) {
  return (
    <article className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={deliveryTone(issue.projectStatus)}>{issue.projectStatus}</Badge>
            <span className="wave-micro-label">Product Change #{issue.number}</span>
          </div>
          <h3 className="font-medium leading-snug">{issue.title}</h3>
          <p className="text-sm text-muted-foreground">
            {pdrRequest
              ? `Request-sourced: ${pdrRequest.title}`
              : "PDR source link is not recorded in the governance projection."}
          </p>
        </div>
        <IssueActions issue={issue} pdrRequest={pdrRequest} />
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="wave-micro-label">Owner</dt><dd>{issue.assigneeLogins.length ? issue.assigneeLogins.join(", ") : "Unassigned"}</dd></div>
        <div><dt className="wave-micro-label">Dependencies</dt><dd>{issue.dependencyNumbers.length ? issue.dependencyNumbers.map((item) => `#${item}`).join(", ") : "None recorded"}</dd></div>
        <div><dt className="wave-micro-label">Delivery</dt><dd>{children.length ? `${children.length} linked ticket${children.length === 1 ? "" : "s"}` : "No linked tickets"}</dd></div>
        <div><dt className="wave-micro-label">Updated</dt><dd>{displayDate(issue.updatedAt)}</dd></div>
      </dl>
      {children.length ? (
        <div className="border-t pt-3">
          <p className="wave-micro-label mb-2">Delivery tickets</p>
          <ul className="space-y-2 text-sm">
            {children.map((child) => (
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

export default async function StrategicPdrPage() {
  await connection();
  await requireStaffAccess();
  const [current, requestResult] = await Promise.all([
    readCurrentGovernanceProjection(),
    listPdrRequestHistory().then((requests) => ({ state: "available" as const, requests })).catch(() => ({ state: "unavailable" as const, requests: [] })),
  ]);

  if (current.state === "unavailable") {
    return <div className="space-y-6"><header className="space-y-2"><p className="wave-micro-label">Strategic PDR</p><h1 className="text-2xl font-semibold">Strategy, delivery and requests</h1></header><Card className="border-destructive/40"><CardHeader><CardTitle>Governance projection unavailable</CardTitle><CardDescription>GitHub is the delivery authority. Its last validated projection is not available in WAVE, so no strategy or delivery relationship is shown.</CardDescription></CardHeader><CardContent><Button asChild variant="outline"><a href="https://github.com/re-new-team/renew-governance/projects" target="_blank" rel="noreferrer">Open GitHub delivery board <ExternalLink className="size-3.5" /></a></Button></CardContent></Card></div>;
  }

  const { projection } = current;
  const isStale = Date.now() - new Date(projection.snapshotAt).valueOf() > STALE_AFTER_MS;
  const pdrByIssue = verifiedPdrRequestByGovernanceIssue(requestResult.requests);
  const productChanges = projection.issues.filter((issue) => issue.kind === "Product Change");
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
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-2"><p className="wave-micro-label">Strategic PDR</p><h1 className="text-2xl font-semibold">Strategy, delivery and requests</h1><p className="max-w-3xl text-sm text-muted-foreground">WAVE holds request intake and the readable strategic view. GitHub is the authoritative place for current product decisions, delivery status and discussion.</p></div>
        <Button asChild variant="outline"><a href="https://github.com/re-new-team/renew-governance/projects" target="_blank" rel="noreferrer">Open delivery board <ExternalLink className="size-3.5" /></a></Button>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span>GitHub revision <code>{projection.sourceCommit.slice(0, 12)}</code></span><span>Registry {projection.registryRevision}</span><span><RefreshCw className="mr-1 inline size-3" />Refreshed {displayDate(projection.snapshotAt)}</span></div>
      {isStale ? <p className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">This WAVE projection is stale. Check GitHub before making a delivery decision.</p> : null}
    </header>

    <section className="space-y-4" aria-labelledby="strategy-heading">
      <div><p className="wave-micro-label">Strategy</p><h2 id="strategy-heading" className="text-xl font-semibold">Goal to outcome milestone to Product Change</h2></div>
      <div className="space-y-4">
        {projection.registry.goals.map((goal) => {
          const milestones = projection.registry.milestones.filter((item) => item.goalId === goal.id && item.lifecycle === "active");
          return <Card key={goal.id}><CardHeader><CardTitle>{goal.id} · {goal.title}</CardTitle><CardDescription>{goal.statement}</CardDescription></CardHeader><CardContent className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-2">{goal.kpiIds.map((kpiId) => { const kpi = projection.registry.kpis.find((item) => item.id === kpiId); return kpi ? <div key={kpi.id} className="rounded-md border p-3"><p className="wave-micro-label">{kpi.id} · KPI</p><p className="font-medium">{kpi.title}</p><p className="mt-1 text-sm text-muted-foreground">Actual: unavailable{ kpi.target.value !== null ? ` · target: ${kpi.target.value} ${kpi.unit}` : " · target: unavailable" }</p></div> : null })}</div>
            {milestones.map((milestone) => { const changes = productChanges.filter((item) => item.placement.goalId === goal.id && item.placement.milestoneId === milestone.id); return <div key={milestone.id} className="space-y-3 border-t pt-5"><div><p className="wave-micro-label">Outcome milestone · {milestone.id} · {milestone.outcomeState.replaceAll("_", " ")}</p><h3 className="font-medium">{milestone.title}</h3><p className="text-sm text-muted-foreground">{milestone.outcome}</p></div>{changes.length ? changes.map((issue) => <ProductChangeCard key={issue.number} issue={issue} pdrRequest={pdrByIssue.get(issue.number)} children={childrenByParent.get(issue.number) ?? []} />) : <p className="text-sm text-muted-foreground">No current Product Change is mapped to this milestone in the validated projection.</p>}</div> })}
          </CardContent></Card>
        })}
      </div>
    </section>

    <section className="space-y-4" aria-labelledby="unmapped-heading"><div><p className="wave-micro-label">Delivery</p><h2 id="unmapped-heading" className="text-xl font-semibold">Product Changes without a current strategic placement</h2></div><Card><CardContent className="space-y-3 pt-6">{productChanges.filter((issue) => issue.placement.goalId === null).map((issue) => <ProductChangeCard key={issue.number} issue={issue} pdrRequest={pdrByIssue.get(issue.number)} children={childrenByParent.get(issue.number) ?? []} />)}{!productChanges.some((issue) => issue.placement.goalId === null) ? <p className="text-sm text-muted-foreground">Every current Product Change has a validated strategic placement.</p> : null}</CardContent></Card></section>

    <section aria-labelledby="requests-heading"><Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="wave-micro-label">Requests</p><CardTitle id="requests-heading">Founder and staff intake</CardTitle><CardDescription>Original requests, AI screening and historical evidence stay in WAVE. They do not change GitHub delivery status.</CardDescription></div><Button asChild size="sm"><Link href="/strategic-pdr/requests"><Inbox className="size-3.5" />Open request intake</Link></Button></div></CardHeader><CardContent className="text-sm text-muted-foreground">{requestResult.state === "available" ? `${requestResult.requests.length} request records are available to staff. A request opens as a Product Change only when a verified handoff link is recorded; otherwise it remains intake evidence, not delivery scope.` : "Request history is temporarily unavailable. GitHub delivery data remains separate and is shown above."}</CardContent></Card></section>
  </div>;
}
