import { describe, expect, it, vi } from "vitest";
import {
  captureMaDirectoryProof,
  cleanupMaDirectoryProof,
  verifyMaDirectoryCleanup,
} from "../ma-directory-proof";

const runId = "2e5b857d-6220-4ad0-a4bf-598f417c9b42";
const firmId = "c6825c38-d2aa-4e0e-9c36-101fc233d610";
const officeId = "eb304f9f-e48b-4a80-bb52-0af4d915e173";
function database(firmName = `QA 257 ${runId} Advisory`) {
  return {
    query: vi.fn(
      async (sql: string): Promise<{ rows: Record<string, unknown>[] }> => {
        if (sql.includes("pg_roles"))
          return { rows: [{ can_observe_references: true }] };
        if (sql.includes("pg_attribute"))
          return {
            rows: [
              { table_name: "ma_firms", columns: ["id", "name"] },
              {
                table_name: "ma_offices",
                columns: ["id", "name", "firm_id", "is_default"],
              },
              {
                table_name: "ma_contacts",
                columns: ["id", "first_name", "last_name"],
              },
              {
                table_name: "ma_contact_office_affiliations",
                columns: ["id", "contact_id", "office_id"],
              },
              {
                table_name: "opportunity_ma_contacts",
                columns: ["opportunity_id", "affiliation_id"],
              },
              { table_name: "email_logs", columns: ["id"] },
            ],
          };
        if (sql.includes("string_agg"))
          return { rows: [{ count: 7, digest: "a".repeat(32) }] };
        if (sql.includes('FROM public."ma_firms"'))
          return {
            rows: [
              {
                id: firmId,
                fingerprint: "b".repeat(32),
                body: { id: firmId, name: firmName },
              },
            ],
          };
        if (sql.includes('FROM public."ma_offices"'))
          return {
            rows: [
              {
                id: officeId,
                fingerprint: "c".repeat(32),
                body: {
                  id: officeId,
                  firm_id: firmId,
                  name: "Central",
                  is_default: false,
                },
              },
            ],
          };
        return { rows: [] };
      },
    ),
  };
}

describe("owned fictional M&A verification", () => {
  it("rejects invalid owned identities before consulting the database", async () => {
    const query = vi.fn();
    await expect(
      captureMaDirectoryProof(
        { query },
        {
          runId: "2e5b857d-6220-4ad0-a4bf-598f417c9b42",
          firms: ["not-an-id"],
          offices: [],
          contacts: [],
        },
      ),
    ).rejects.toThrow("Invalid owned M&A graph");
    expect(query).not.toHaveBeenCalled();
  });
  it("captures structured persisted identities without returning row contents", async () => {
    const db = database();
    const proof = await captureMaDirectoryProof(db, {
      runId,
      firms: [firmId],
      offices: [officeId],
      contacts: [],
    });
    expect(proof).toMatchObject({
      schema: 1,
      owned: { runId },
      rows: [
        { table: "ma_firms", id: firmId, fingerprint: "b".repeat(32) },
        { table: "ma_offices", id: officeId, fingerprint: "c".repeat(32) },
      ],
    });
    expect(JSON.stringify(proof)).not.toContain("Central");
    expect(JSON.stringify(proof)).not.toContain("Advisory");
  });
  it("refuses a real firm even when its identifier appears in the owned request", async () => {
    await expect(
      captureMaDirectoryProof(database("Real Advisory"), {
        runId,
        firms: [firmId],
        offices: [officeId],
        contacts: [],
      }),
    ).rejects.toThrow("M&A ownership mismatch");
  });
  it("blocks an external reference before deletion even if its foreign key could cascade", async () => {
    const db = database();
    const proof = await captureMaDirectoryProof(db, {
      runId,
      firms: [firmId],
      offices: [officeId],
      contacts: [],
    });
    const original = db.query.getMockImplementation()!;
    db.query.mockImplementation(async (sql) => {
      if (sql.includes("pg_constraint"))
        return {
          rows: [
            {
              child_schema: "public",
              child_table: "unrelated_history",
              parent_table: "ma_offices",
              child_columns: ["office_id"],
              parent_columns: ["id"],
            },
          ],
        };
      if (sql.includes('JOIN public."ma_offices" p'))
        return { rows: [{ count: 1 }] };
      return original(sql);
    });
    await expect(
      cleanupMaDirectoryProof(db, proof, { commit: true }),
    ).rejects.toThrow("External M&A reference blocks cleanup");
    expect(db.query.mock.calls.some(([sql]) => sql.startsWith("DELETE"))).toBe(
      false,
    );
  });
  it("rejects a cleanup claim when a fresh read still finds an owned record", async () => {
    const db = database();
    const proof = await captureMaDirectoryProof(db, {
      runId,
      firms: [firmId],
      offices: [officeId],
      contacts: [],
    });
    const original = db.query.getMockImplementation()!;
    db.query.mockImplementation(async (sql) =>
      sql.startsWith("SELECT count(*)") && !sql.includes("string_agg")
        ? { rows: [{ count: 1 }] }
        : original(sql),
    );
    await expect(verifyMaDirectoryCleanup(db, proof)).rejects.toThrow(
      "Owned M&A residue remains",
    );
  });
  it("refuses an incomplete manifest rather than verifying an empty list of records", async () => {
    const db = database();
    const proof = await captureMaDirectoryProof(db, {
      runId,
      firms: [firmId],
      offices: [officeId],
      contacts: [],
    });
    await expect(
      verifyMaDirectoryCleanup(db, { ...proof, rows: [] }),
    ).rejects.toThrow("Invalid M&A proof manifest");
  });
  it("rejects cleanup with a role that could hide foreign references through RLS", async () => {
    const db = database();
    const proof = await captureMaDirectoryProof(db, {
      runId,
      firms: [firmId],
      offices: [officeId],
      contacts: [],
    });
    const original = db.query.getMockImplementation()!;
    db.query.mockImplementation(async (sql) =>
      sql.includes("pg_roles")
        ? { rows: [{ can_observe_references: false }] }
        : original(sql),
    );
    await expect(
      cleanupMaDirectoryProof(db, proof, { commit: true }),
    ).rejects.toThrow(
      "M&A cleanup requires a role that can observe all references",
    );
    expect(db.query.mock.calls.some(([sql]) => sql.startsWith("DELETE"))).toBe(
      false,
    );
  });
});
