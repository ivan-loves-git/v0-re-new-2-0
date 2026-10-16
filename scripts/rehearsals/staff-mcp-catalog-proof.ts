import assert from "node:assert/strict";
import { Pool } from "pg";
import { createCatalog } from "../../lib/mcp/catalog";

// The production table catalog through the real `pg` driver against the
// disposable #265 database: key and relation columns arrive as arrays, single
// and composite, so describe_table works on every exposed table.
async function main() {
  const url = process.env.STAFF_MCP_REHEARSAL_DATABASE_URL;
  if (
    !url ||
    new URL(url).hostname !== "127.0.0.1" ||
    new URL(url).pathname !== "/staff_mcp"
  ) {
    throw new Error("Staff MCP rehearsal requires its disposable database");
  }
  const pool = new Pool({ connectionString: url, max: 2 });
  try {
    await pool.query(`
      CREATE TABLE public.ma_firms (id uuid PRIMARY KEY, name text NOT NULL);
      CREATE TABLE public.ma_offices (
        id uuid PRIMARY KEY,
        firm_id uuid NOT NULL REFERENCES public.ma_firms(id),
        "userId" text REFERENCES public."user"(id),
        city text,
        claim_token uuid);
      CREATE TABLE public.ma_contacts (id uuid PRIMARY KEY, full_name text);
      CREATE TABLE public.ma_contact_office_affiliations (
        contact_id uuid REFERENCES public.ma_contacts(id),
        office_id uuid REFERENCES public.ma_offices(id),
        PRIMARY KEY (contact_id, office_id));
      CREATE TABLE public.affiliation_notes (
        id uuid PRIMARY KEY,
        contact_id uuid,
        office_id uuid,
        FOREIGN KEY (contact_id, office_id)
          REFERENCES public.ma_contact_office_affiliations(contact_id, office_id));
    `);

    const catalog = createCatalog(pool);
    const listed = (await catalog.listTables()).map((table) => table.name);
    for (const name of ["ma_firms", "ma_offices", "ma_contact_office_affiliations"]) {
      assert.ok(listed.includes(name), `${name} is listed`);
    }
    for (const name of ["user", "session", "oauthAccessToken"]) {
      assert.ok(!listed.includes(name), `${name} stays hidden`);
    }

    const shape = async (name: string) => {
      const table = await catalog.describeTable(name);
      assert.ok(table, `${name} is described`);
      return {
        columns: table.columns.map((column) => [column.name, column.primaryKey, column.references]),
        referencedBy: table.referencedBy,
      };
    };

    assert.deepEqual(await shape("ma_offices"), {
      columns: [
        ["id", true, null],
        ["firm_id", false, "ma_firms.id"],
        ["userId", false, null],
        ["city", false, null],
      ],
      referencedBy: ["ma_contact_office_affiliations"],
    });
    assert.deepEqual(await shape("ma_contact_office_affiliations"), {
      columns: [
        ["contact_id", true, "ma_contacts.id"],
        ["office_id", true, "ma_offices.id"],
      ],
      referencedBy: ["affiliation_notes"],
    });
    assert.deepEqual((await shape("affiliation_notes")).columns, [
      ["id", true, null],
      ["contact_id", false, "ma_contact_office_affiliations.contact_id"],
      ["office_id", false, "ma_contact_office_affiliations.office_id"],
    ]);
    assert.deepEqual((await shape("ma_firms")).referencedBy, ["ma_offices"]);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
