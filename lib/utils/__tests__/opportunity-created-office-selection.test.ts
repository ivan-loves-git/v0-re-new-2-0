import { describe, expect, it } from "vitest";
import {
  resolveOpportunityOfficeChoice,
  selectCreatedOfficeContext,
} from "@/lib/utils/opportunity-created-office-selection";

const createdOffice = {
  office_id: "office-created",
  firm_id: "firm-created",
  firm_name: "Acme Conseil",
  office_name: "Paris",
  office_label: "Acme Conseil — Paris",
  contacts: [
    {
      affiliation_id: "affiliation-created",
      contact_id: "contact-created",
      contact_name: "Camille Durand",
      contact_email: "camille@example.com",
    },
  ],
};

describe("created opportunity office selection", () => {
  it("ignores an internal empty select event after inline creation", () => {
    expect(resolveOpportunityOfficeChoice("", "__no_office__")).toBeNull();
  });

  it("keeps explicit staff selection and clearing distinct", () => {
    expect(
      resolveOpportunityOfficeChoice("office-created", "__no_office__"),
    ).toBe("office-created");
    expect(
      resolveOpportunityOfficeChoice("__no_office__", "__no_office__"),
    ).toBe("");
  });

  it("keeps a newly created firm office and its first contact selected", () => {
    expect(selectCreatedOfficeContext(createdOffice, "new_firm")).toEqual({
      selectedOfficeId: "office-created",
      affiliationIds: ["affiliation-created"],
      primaryAffiliationId: "affiliation-created",
    });
  });

  it("keeps a new existing-firm office selected without selecting contacts", () => {
    expect(selectCreatedOfficeContext(createdOffice, "existing_firm")).toEqual({
      selectedOfficeId: "office-created",
      affiliationIds: [],
      primaryAffiliationId: null,
    });
  });
});
