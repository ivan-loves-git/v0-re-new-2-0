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
  });

  it("keeps Strategic PDR as a Project navigation entry", () => {
    expect(source("components/app-sidebar.tsx")).toContain('name: "Strategic PDR"');
  });
});
