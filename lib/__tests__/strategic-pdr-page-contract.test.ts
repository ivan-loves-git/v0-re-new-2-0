import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Strategic PDR page contract", () => {
  it("uses the validated projection and keeps GitHub delivery actions canonical", () => {
    const page = source("app/(dashboard)/strategic-pdr/page.tsx");
    expect(page).toContain("readCurrentGovernanceProjection");
    expect(page).toContain("Open / Discuss in GitHub");
    expect(page).toContain("Direct GitHub scope");
    expect(page).toContain("pdr_work_card");
    expect(page).toContain("/strategic-pdr/work-cards/");
    expect(page).toContain("Actual: unavailable");
    expect(page).toContain("Direct GitHub scope, with verified historical PDR Work Card");
    expect(page).toContain('const GOVERNANCE_PROJECT_URL = "https://github.com/orgs/re-new-team/projects/1"');
  });

  it("keeps Strategic PDR as a Project navigation entry", () => {
    expect(source("components/app-sidebar.tsx")).toContain('name: "Strategic PDR"');
  });

  it("closes the AI screening affordance after an Ivan disposition while retaining its saved history", () => {
    const page = source("app/(dashboard)/strategic-pdr/requests/[requestId]/page.tsx");
    expect(page).toContain('dispositionEligible ? <PdrScreeningEditor requestId={request.id}/> : request.disposition.kind ? <p className="text-muted-foreground">AI screening is closed after Ivan’s disposition.</p>');
    expect(page).toContain("Saved AI screening history");
  });
});
