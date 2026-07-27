import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("W-065 staff source review UI", () => {
  const reviewPanel = source(
    "components/opportunities/opportunity-source-review-panel.tsx",
  );
  const staffDetail = source("components/opportunities/opportunity-detail.tsx");
  const staffList = source(
    "components/opportunities/opportunity-work-surface-table.tsx",
  );
  const portalDetail = source(
    "components/opportunities/repreneur-opportunity-detail.tsx",
  );
  const reviewProjection = source("lib/data/provisional-source-review.ts");
  const intakeActions = source("lib/actions/opportunity-intake.ts");
  const closureControls = source("components/opportunities/opportunity-closure-controls.tsx");
  const legacyTable = source("components/opportunities/opportunity-table.tsx");

  it("renders the correction only for computed staff review state and uses the W-064 resolver", () => {
    expect(staffDetail).toContain("opportunity.source_review_required");
    expect(reviewPanel).toContain("Source review required");
    expect(reviewPanel).toContain("source_review_reason");
    expect(reviewPanel).toContain("Save verified source");
  });

  it("shows a staff-list badge and filter without extending any repreneur surface", () => {
    expect(staffList).toContain('key: "sourceReview"');
    expect(staffList).toContain("Source review required");
    expect(portalDetail).not.toContain("source_review_required");
    expect(portalDetail).not.toContain("Source review required");
  });

  it("does not allow the current provisional office to be selected as the replacement", () => {
    expect(reviewPanel).toContain(
      "office.office_id !== opportunity.source_office_id",
    );
  });

  it("derives list state through bounded staff-only reads instead of per-row RPCs", () => {
    expect(reviewProjection).toContain("ma_provisional_source_contexts");
    expect(reviewProjection).toContain("ma_provisional_source_review_events");
    expect(reviewProjection).not.toContain(
      "ma_opportunity_source_review_required",
    );
    expect(reviewProjection).toContain("source_review_required:");
  });

  it("keeps the provisional office out of ordinary intake and disables close while review is unresolved", () => {
    expect(intakeActions).toContain("row.office_id === provisionalOfficeId && !mayIncludeCurrentProvisionalOffice");
    expect(intakeActions).toContain("includeCurrentProvisionalOfficeId");
    expect(closureControls).toContain("sourceReviewRequired");
    expect(closureControls).toContain("Close is unavailable until the provisional source is corrected");
    expect(legacyTable).toContain("Source review required before archive");
  });
});
