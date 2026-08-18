import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Opportunity source-context boundary", () => {
  it("keeps the complete staff source workflow behind one self-contained fieldset", () => {
    const form = readFileSync(
      `${root}/components/opportunities/opportunity-form.tsx`,
      "utf8",
    );
    const sourceContext = readFileSync(
      `${root}/components/opportunities/opportunity-source-context.tsx`,
      "utf8",
    );

    expect(form).toContain(
      'import { OpportunitySourceContext } from "@/components/opportunities/opportunity-source-context"',
    );
    expect(form).toContain("<OpportunitySourceContext");
    expect(form).toContain("clearFieldError={clearFieldError}");

    expect(sourceContext).toContain('name="source_office_id"');
    expect(sourceContext).toContain('name="affiliation_ids"');
    expect(sourceContext).toContain('name="primary_affiliation_id"');
    expect(sourceContext).toContain("createMaFirmOfficeContext");
    expect(sourceContext).toContain("createMaOfficeForExistingFirm");
    expect(sourceContext).toContain("createMaOfficeContact");
    expect(sourceContext).toContain("listMaCanonicalContactOptions");
    expect(sourceContext).toContain("setSelectedAffiliationIds([])");
    expect(sourceContext).toContain("setPrimaryAffiliationId(null)");
    expect(sourceContext).toContain("selectCreatedOfficeContext");
  });

  it("keeps failed opportunity-save feedback focused by the parent form", () => {
    const form = readFileSync(
      `${root}/components/opportunities/opportunity-form.tsx`,
      "utf8",
    );

    expect(form).toContain("focusValidationSummary(validationSummaryRef)");
    expect(form).toContain("}, [fieldErrors])");
  });
});
