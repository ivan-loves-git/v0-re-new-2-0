import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  session: vi.fn(),
  roles: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("better-auth", () => ({
  betterAuth: () => ({ api: { getSession: boundary.session } }),
}));
vi.mock("better-auth/next-js", () => ({ nextCookies: () => ({}) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("pg", () => ({ Pool: class {} }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: boundary.rpc,
    from: (table: string) => {
      if (table !== "app_user_roles")
        throw new Error(`Unexpected table: ${table}`);
      return { select: () => ({ or: () => ({ limit: boundary.roles }) }) };
    },
  }),
}));

import {
  createMaFirmOfficeContext,
  createMaOfficeContact,
  createMaOfficeForExistingFirm,
} from "@/lib/actions/opportunity-intake";
import {
  updateMaFirmCorrection,
  updateMaOfficeCorrection,
  updateMaContactCorrection,
  updateMaRelationshipWorkspaceNotes,
} from "@/lib/actions/ma-relationship-workspaces";

const firmId = "25700000-0000-4000-8000-000000000001";
const officeId = "25700000-0000-4000-8000-000000000011";
function firmForm() {
  const form = new FormData();
  form.set("firm_name", "Synthetic Advisory");
  form.set("office_name", "Central office");
  form.set("office_city", "Lyon");
  return form;
}

describe("staff M&A directory creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.session.mockResolvedValue({
      user: { id: "synthetic-staff", email: "staff@example.invalid" },
    });
    boundary.roles.mockResolvedValue({
      data: [
        {
          role: "staff",
          user_id: "synthetic-staff",
          email: "staff@example.invalid",
        },
      ],
      error: null,
    });
    boundary.rpc.mockResolvedValue({
      data: [
        {
          firm_id: firmId,
          office_id: officeId,
          contact_id: null,
          affiliation_id: null,
        },
      ],
      error: null,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("creates an operational firm and real first office without inventing a contact", async () => {
    const result = await createMaFirmOfficeContext(firmForm());
    expect(result.success).toBe(true);
    expect(result.office).toMatchObject({
      firm_id: firmId,
      office_id: officeId,
      firm_name: "Synthetic Advisory",
      firm_status: "active",
      office_name: "Central office",
      contacts: [],
    });
  });

  it.each(["firm_name", "office_name", "office_city"])(
    "rejects blank %s before persistence",
    async (field) => {
      const form = firmForm();
      form.set(field, "   ");
      const result = await createMaFirmOfficeContext(form);
      expect(result.success).toBe(false);
      expect(result.fieldErrors?.[field]).toBeTruthy();
      expect(boundary.rpc).not.toHaveBeenCalled();
    },
  );

  it("rejects an explicitly requested first contact without a channel, without creating the graph", async () => {
    const form = firmForm();
    form.set("include_contact", "true");
    form.set("contact_first_name", "Synthetic");
    const result = await createMaFirmOfficeContext(form);
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.contact_email).toBeTruthy();
    expect(result.fieldErrors?.contact_phone).toBeTruthy();
    expect(boundary.rpc).not.toHaveBeenCalled();
  });

  it("rejects a named office contact with neither channel", async () => {
    const form = new FormData();
    form.set("contact_first_name", "Synthetic");
    form.set("contact_phone", "   ");
    const result = await createMaOfficeContact(officeId, form);
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.contact_email).toBeTruthy();
    expect(result.fieldErrors?.contact_phone).toBeTruthy();
    expect(boundary.rpc).not.toHaveBeenCalled();
  });

  it("requires a city when adding an office to an existing firm", async () => {
    const form = new FormData();
    form.set("existing_firm_id", firmId);
    form.set("office_name", "North office");
    const result = await createMaOfficeForExistingFirm(form);
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.office_city).toBeTruthy();
    expect(boundary.rpc).not.toHaveBeenCalled();
  });

  it("rejects an office profile correction without city before writes", async () => {
    const form = new FormData();
    form.set("name", "Changed office");
    const result = await updateMaOfficeCorrection(officeId, form);
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.city).toBeTruthy();
    expect(boundary.rpc).not.toHaveBeenCalled();
  });

  it("rejects a contact profile correction without a channel before writes", async () => {
    const form = new FormData();
    form.set("first_name", "Changed person");
    form.set("office_id", officeId);
    const result = await updateMaContactCorrection(
      "25700000-0000-4000-8000-000000000021",
      "25700000-0000-4000-8000-000000000031",
      form,
    );
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.email).toBeTruthy();
    expect(result.fieldErrors?.phone).toBeTruthy();
    expect(boundary.rpc).not.toHaveBeenCalled();
  });

  it("explains missing city when the notes-only office save is rejected", async () => {
    boundary.rpc.mockResolvedValue({
      data: null,
      error: { message: "ma_office_city_required" },
    });
    const result = await updateMaRelationshipWorkspaceNotes(
      "office",
      officeId,
      "Notes retained on failure",
    );
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.city).toBeTruthy();
  });

  it("warns about a shared email while retaining the distinct new person", async () => {
    const form = new FormData();
    form.set("contact_first_name", "Separate person");
    form.set("contact_email", "shared@example.invalid");
    boundary.rpc
      .mockResolvedValueOnce({
        data: [
          {
            contact_id: "25700000-0000-4000-8000-000000000022",
            affiliation_id: "25700000-0000-4000-8000-000000000032",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });
    const result = await createMaOfficeContact(officeId, form);
    expect(result.success).toBe(true);
    expect(result.contact?.contact_id).toBe(
      "25700000-0000-4000-8000-000000000022",
    );
    expect(result.message).toContain("Another contact uses this email");
  });

  it.each([
    null,
    {
      user: { id: "synthetic-unassigned", email: "unassigned@example.invalid" },
    },
  ])(
    "denies unauthenticated and non-staff writes through the actual role guard",
    async (session) => {
      boundary.session.mockResolvedValue(session);
      boundary.roles.mockResolvedValue({ data: [], error: null });
      const actions = [
        () => createMaFirmOfficeContext(firmForm()),
        () => createMaOfficeForExistingFirm(firmForm()),
        () => createMaOfficeContact(officeId, new FormData()),
        () => updateMaFirmCorrection(firmId, new FormData()),
        () => updateMaOfficeCorrection(officeId, new FormData()),
        () =>
          updateMaContactCorrection(
            "25700000-0000-4000-8000-000000000021",
            "25700000-0000-4000-8000-000000000031",
            new FormData(),
          ),
        () =>
          updateMaRelationshipWorkspaceNotes(
            "office",
            officeId,
            "Forged notes",
          ),
        () =>
          updateMaRelationshipWorkspaceNotes("firm", firmId, "Forged notes"),
      ];
      for (const action of actions) await expect(action()).rejects.toThrow();
      expect(boundary.rpc).not.toHaveBeenCalled();
    },
  );

  it.each(["email", "phone"])(
    "accepts a %s-only contact with its returned identity",
    async (channel) => {
      const form = new FormData();
      form.set("contact_last_name", "Synthetic");
      form.set(
        `contact_${channel}`,
        channel === "email" ? "synthetic@example.invalid" : "+33 1 00 00 00 00",
      );
      boundary.rpc
        .mockResolvedValueOnce({
          data: [
            {
              contact_id: "25700000-0000-4000-8000-000000000022",
              affiliation_id: "25700000-0000-4000-8000-000000000032",
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({ data: false, error: null });
      const result = await createMaOfficeContact(officeId, form);
      expect(result.success).toBe(true);
      expect(result.contact?.contact_id).toBe(
        "25700000-0000-4000-8000-000000000022",
      );
    },
  );

  it("rejects malformed supplied email even with a phone", async () => {
    const form = new FormData();
    form.set("contact_first_name", "Synthetic");
    form.set("contact_email", "malformed");
    form.set("contact_phone", "+33 1 00 00 00 00");
    const result = await createMaOfficeContact(officeId, form);
    expect(result.success).toBe(false);
    expect(result.fieldErrors?.contact_email).toBeTruthy();
    expect(boundary.rpc).not.toHaveBeenCalled();
  });
});
