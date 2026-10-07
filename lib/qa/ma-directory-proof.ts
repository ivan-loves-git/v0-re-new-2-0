import { z } from "zod";

/** Only our fixed diagnostics may cross the CLI's privacy boundary. */
export class MaProofError extends Error {}

export interface MaProofDatabase {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
}

const graphSchema = z
  .object({
    runId: z.uuid(),
    firms: z.array(z.uuid()),
    offices: z.array(z.uuid()),
    contacts: z.array(z.uuid()),
  })
  .strict();
export type OwnedMaGraph = z.infer<typeof graphSchema>;

const tables = [
  "ma_firms",
  "ma_offices",
  "ma_contacts",
  "ma_contact_office_affiliations",
] as const;
type MaTable = (typeof tables)[number];
const retainedTables = [
  ...tables,
  "opportunity_ma_contacts",
  "email_logs",
] as const;
type RetainedTable = (typeof retainedTables)[number];
type PersistedRow = {
  id: string;
  fingerprint: string;
  body: Record<string, unknown>;
};
type RowProof = { table: MaTable; id: string; fingerprint: string };
export type MaDirectoryProof = {
  schema: 1;
  owned: OwnedMaGraph;
  rows: RowProof[];
  retained: Record<RetainedTable, { count: number; digest: string }>;
};

function ownedGraph(input: unknown): OwnedMaGraph {
  const graph = graphSchema.safeParse(input);
  if (
    !graph.success ||
    ![...graph.data.firms, ...graph.data.offices, ...graph.data.contacts].length
  ) {
    throw new MaProofError("Invalid owned M&A graph");
  }
  const ids = [
    ...graph.data.firms,
    ...graph.data.offices,
    ...graph.data.contacts,
  ];
  if (new Set(ids).size !== ids.length)
    throw new MaProofError("Invalid owned M&A graph");
  return graph.data;
}

export async function inspectMaDirectorySchema(db: MaProofDatabase) {
  const required: Record<RetainedTable, string[]> = {
    ma_firms: ["id", "name"],
    ma_offices: ["id", "name", "firm_id", "is_default"],
    ma_contacts: ["id", "first_name", "last_name"],
    ma_contact_office_affiliations: ["id", "contact_id", "office_id"],
    // Retained tables are hashed as complete rows; they need no assumed PK.
    opportunity_ma_contacts: [],
    email_logs: [],
  };
  const { rows } = await db.query(
    `SELECT c.relname::text AS table_name, array_agg(a.attname::text) AS columns
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND a.attnum>0 AND NOT a.attisdropped GROUP BY c.relname`,
    [retainedTables],
  );
  for (const table of retainedTables) {
    const columns = rows.find((row) => row.table_name === table)?.columns;
    if (
      !Array.isArray(columns) ||
      required[table].some((column) => !columns.includes(column))
    ) {
      throw new MaProofError(`M&A schema mismatch: ${table}`);
    }
  }
  return { schema: 1, readOnly: true, tables: [...retainedTables] };
}

export async function discoverOwnedMaGraph(
  db: MaProofDatabase,
  input: unknown,
): Promise<OwnedMaGraph> {
  const id = z.uuid().safeParse(input);
  if (!id.success) throw new MaProofError("Invalid owned M&A graph");
  await inspectMaDirectorySchema(db);
  const { rows } = await db.query(
    `SELECT
    ARRAY(SELECT id FROM public.ma_firms WHERE starts_with(name,$1) ORDER BY id) AS firms,
    ARRAY(SELECT o.id FROM public.ma_offices o JOIN public.ma_firms f ON f.id=o.firm_id
      WHERE starts_with(o.name,$1) OR starts_with(f.name,$1) ORDER BY o.id) AS offices,
    ARRAY(SELECT id FROM public.ma_contacts WHERE starts_with(first_name,$1) OR starts_with(last_name,$1) ORDER BY id) AS contacts`,
    [`QA 257 ${id.data} `],
  );
  return ownedGraph({ runId: id.data, ...rows[0] });
}

async function readOwned(
  db: MaProofDatabase,
  graph: OwnedMaGraph,
  lock = false,
) {
  const rows: Record<MaTable, PersistedRow[]> = {
    ma_firms: [],
    ma_offices: [],
    ma_contacts: [],
    ma_contact_office_affiliations: [],
  };
  for (const [table, ids] of [
    ["ma_firms", graph.firms],
    ["ma_offices", graph.offices],
    ["ma_contacts", graph.contacts],
  ] as const) {
    const result = await db.query(
      `SELECT t.id::text, md5(to_jsonb(t)::text) AS fingerprint, to_jsonb(t) AS body
      FROM public."${table}" t WHERE t.id=ANY($1::uuid[]) ORDER BY t.id${lock ? " FOR UPDATE" : ""}`,
      [ids],
    );
    rows[table] = result.rows as PersistedRow[];
    if (rows[table].length !== ids.length)
      throw new MaProofError("Owned M&A records are missing");
  }
  rows.ma_contact_office_affiliations = (
    await db.query(
      `SELECT t.id::text, md5(to_jsonb(t)::text) AS fingerprint, to_jsonb(t) AS body
    FROM public."ma_contact_office_affiliations" t WHERE t.contact_id=ANY($1::uuid[]) OR t.office_id=ANY($2::uuid[])
    ORDER BY t.id${lock ? " FOR UPDATE" : ""}`,
      [graph.contacts, graph.offices],
    )
  ).rows as PersistedRow[];
  return rows;
}

async function retainedReadback(db: MaProofDatabase, rows: RowProof[]) {
  const result = {} as MaDirectoryProof["retained"];
  for (const table of retainedTables) {
    const ids = rows.filter((row) => row.table === table).map((row) => row.id);
    const ownedTable = tables.includes(table as MaTable);
    const readback = await db.query(
      `SELECT count(*)::int AS count,
      md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text),'')) AS digest
      FROM public."${table}" t ${ownedTable ? "WHERE NOT (t.id=ANY($1::uuid[]))" : ""}`,
      ownedTable ? [ids] : [],
    );
    result[table] = readback.rows[0] as { count: number; digest: string };
  }
  return result;
}

function validateOwnership(
  rows: Record<MaTable, PersistedRow[]>,
  graph: OwnedMaGraph,
) {
  const prefix = `QA 257 ${graph.runId} `;
  const tagged = (value: unknown) =>
    typeof value === "string" && value.startsWith(prefix);
  const valid =
    rows.ma_firms.every((row) => tagged(row.body.name)) &&
    rows.ma_offices.every(
      (row) =>
        graph.firms.includes(String(row.body.firm_id)) ||
        (tagged(row.body.name) && row.body.is_default === false),
    ) &&
    rows.ma_contacts.every(
      (row) => tagged(row.body.first_name) || tagged(row.body.last_name),
    ) &&
    rows.ma_contact_office_affiliations.every(
      (row) =>
        graph.contacts.includes(String(row.body.contact_id)) &&
        graph.offices.includes(String(row.body.office_id)),
    );
  if (!valid) throw new MaProofError("M&A ownership mismatch");
}

export async function captureMaDirectoryProof(
  db: MaProofDatabase,
  input: unknown,
): Promise<MaDirectoryProof> {
  const graph = ownedGraph(input);
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await inspectMaDirectorySchema(db);
    const owned = await readOwned(db, graph);
    validateOwnership(owned, graph);
    const rows = tables.flatMap((table) =>
      owned[table].map(({ id, fingerprint }) => ({ table, id, fingerprint })),
    );
    return {
      schema: 1,
      owned: graph,
      rows,
      retained: await retainedReadback(db, rows),
    };
  } finally {
    await db.query("ROLLBACK");
  }
}

const fingerprintSchema = z.string().regex(/^[a-f0-9]{32}$/);
const proofSchema = z
  .object({
    schema: z.literal(1),
    owned: graphSchema,
    rows: z.array(
      z
        .object({
          table: z.enum(tables),
          id: z.uuid(),
          fingerprint: fingerprintSchema,
        })
        .strict(),
    ),
    retained: z
      .object(
        Object.fromEntries(
          retainedTables.map((table) => [
            table,
            z
              .object({
                count: z.number().int().nonnegative(),
                digest: fingerprintSchema,
              })
              .strict(),
          ]),
        ),
      )
      .strict(),
  })
  .strict();

function parsedProof(input: unknown): MaDirectoryProof {
  const parsed = proofSchema.safeParse(input);
  if (!parsed.success) throw new MaProofError("Invalid M&A proof manifest");
  ownedGraph(parsed.data.owned);
  for (const [table, ids] of [
    ["ma_firms", parsed.data.owned.firms],
    ["ma_offices", parsed.data.owned.offices],
    ["ma_contacts", parsed.data.owned.contacts],
  ] as const) {
    if (
      parsed.data.rows
        .filter((row) => row.table === table)
        .map((row) => row.id)
        .sort()
        .join() !== [...ids].sort().join()
    ) {
      throw new MaProofError("Invalid M&A proof manifest");
    }
  }
  if (
    new Set(parsed.data.rows.map((row) => `${row.table}:${row.id}`)).size !==
      parsed.data.rows.length ||
    (!parsed.data.owned.contacts.length &&
      parsed.data.rows.some(
        (row) => row.table === "ma_contact_office_affiliations",
      ))
  ) {
    throw new MaProofError("Invalid M&A proof manifest");
  }
  return parsed.data as MaDirectoryProof;
}

function rowIdentities(rows: RowProof[]) {
  return rows
    .map((row) => `${row.table}:${row.id}:${row.fingerprint}`)
    .sort()
    .join("\n");
}

async function requireUnchangedOwned(
  db: MaProofDatabase,
  proof: MaDirectoryProof,
  lock: boolean,
) {
  await inspectMaDirectorySchema(db);
  const current = await readOwned(db, proof.owned, lock);
  validateOwnership(current, proof.owned);
  const rows = tables.flatMap((table) =>
    current[table].map(({ id, fingerprint }) => ({ table, id, fingerprint })),
  );
  if (rowIdentities(rows) !== rowIdentities(proof.rows))
    throw new MaProofError("Owned M&A records changed after capture");
}

async function requireRetainedUnchanged(
  db: MaProofDatabase,
  proof: MaDirectoryProof,
) {
  const current = await retainedReadback(db, proof.rows);
  for (const table of retainedTables) {
    if (
      current[table].count !== proof.retained[table].count ||
      current[table].digest !== proof.retained[table].digest
    ) {
      throw new MaProofError(`Retained data changed: ${table}`);
    }
  }
}

export async function verifyMaDirectoryProof(
  db: MaProofDatabase,
  input: unknown,
) {
  const proof = parsedProof(input);
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await requireUnchangedOwned(db, proof, false);
    await requireRetainedUnchanged(db, proof);
    return {
      schema: 1,
      readOnly: true,
      persistedRecords: proof.rows.length,
      retainedUnchanged: true,
    };
  } finally {
    await db.query("ROLLBACK");
  }
}

async function requireZeroResidue(
  db: MaProofDatabase,
  proof: MaDirectoryProof,
) {
  for (const table of tables) {
    const remaining = await db.query(
      `SELECT count(*)::int AS count FROM public."${table}" WHERE id=ANY($1::uuid[])`,
      [proof.rows.filter((row) => row.table === table).map((row) => row.id)],
    );
    if (remaining.rows[0]?.count !== 0)
      throw new MaProofError("Owned M&A residue remains");
  }
}

export async function verifyMaDirectoryCleanup(
  db: MaProofDatabase,
  input: unknown,
) {
  const proof = parsedProof(input);
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await inspectMaDirectorySchema(db);
    await requireZeroResidue(db, proof);
    await requireRetainedUnchanged(db, proof);
    return { schema: 1, readOnly: true, remaining: 0, retainedUnchanged: true };
  } finally {
    await db.query("ROLLBACK");
  }
}

function identifier(value: unknown): string {
  if (typeof value !== "string" || !value || value.includes("\0"))
    throw new MaProofError("Invalid database reference metadata");
  return `"${value.replaceAll('"', '""')}"`;
}

async function requireNoExternalReferences(
  db: MaProofDatabase,
  proof: MaDirectoryProof,
) {
  // Inspect every inbound FK, across schemas and deletion policies. A cascade
  // would otherwise silently remove history even though DELETE itself succeeds.
  const references = (
    await db.query(
      `SELECT cn.nspname::text AS child_schema, cc.relname::text AS child_table,
    pc.relname::text AS parent_table, array_agg(ca.attname::text ORDER BY k.position) AS child_columns,
    array_agg(pa.attname::text ORDER BY k.position) AS parent_columns
    FROM pg_constraint con JOIN pg_class cc ON cc.oid=con.conrelid JOIN pg_namespace cn ON cn.oid=cc.relnamespace
    JOIN pg_class pc ON pc.oid=con.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace
    JOIN LATERAL unnest(con.conkey,con.confkey) WITH ORDINALITY AS k(child_num,parent_num,position) ON true
    JOIN pg_attribute ca ON ca.attrelid=cc.oid AND ca.attnum=k.child_num
    JOIN pg_attribute pa ON pa.attrelid=pc.oid AND pa.attnum=k.parent_num
    WHERE con.contype='f' AND pn.nspname='public' AND pc.relname=ANY($1::text[])
    GROUP BY con.oid,cn.nspname,cc.relname,pc.relname`,
      [tables],
    )
  ).rows;
  for (const reference of references) {
    const parentIds = proof.rows
      .filter((row) => row.table === reference.parent_table)
      .map((row) => row.id);
    if (!parentIds.length) continue;
    const childColumns = reference.child_columns,
      parentColumns = reference.parent_columns;
    if (
      !Array.isArray(childColumns) ||
      !Array.isArray(parentColumns) ||
      !childColumns.length ||
      childColumns.length !== parentColumns.length
    ) {
      throw new MaProofError("Invalid database reference metadata");
    }
    const join = childColumns
      .map(
        (column, index) =>
          `c.${identifier(column)}=p.${identifier(parentColumns[index])}`,
      )
      .join(" AND ");
    const ownedChild =
      reference.child_schema === "public" &&
      tables.includes(reference.child_table as MaTable);
    const childIds = proof.rows
      .filter((row) => row.table === reference.child_table)
      .map((row) => row.id);
    const result = await db.query(
      `SELECT count(*)::int AS count FROM ${identifier(reference.child_schema)}.${identifier(reference.child_table)} c
      JOIN public.${identifier(reference.parent_table)} p ON ${join} WHERE p.id=ANY($1::uuid[])
      ${ownedChild ? "AND NOT (c.id=ANY($2::uuid[]))" : ""}`,
      ownedChild ? [parentIds, childIds] : [parentIds],
    );
    if (result.rows[0]?.count !== 0)
      throw new MaProofError("External M&A reference blocks cleanup");
  }
}

export async function cleanupMaDirectoryProof(
  db: MaProofDatabase,
  input: unknown,
  { commit = false } = {},
) {
  const proof = parsedProof(input);
  let committed = false;
  await db.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  try {
    await db.query("SET LOCAL lock_timeout='3s'");
    await db.query("SET LOCAL statement_timeout='15s'");
    const role = await db.query(
      "SELECT rolsuper OR rolbypassrls AS can_observe_references FROM pg_roles WHERE rolname=current_user",
    );
    if (role.rows[0]?.can_observe_references !== true) {
      throw new MaProofError(
        "M&A cleanup requires a role that can observe all references",
      );
    }
    await requireUnchangedOwned(db, proof, true);
    await requireNoExternalReferences(db, proof);
    for (const table of [
      "ma_contact_office_affiliations",
      "ma_contacts",
      "ma_offices",
      "ma_firms",
    ] as const) {
      await db.query(`DELETE FROM public."${table}" WHERE id=ANY($1::uuid[])`, [
        proof.rows.filter((row) => row.table === table).map((row) => row.id),
      ]);
    }
    await db.query("SET CONSTRAINTS ALL IMMEDIATE");
    await requireZeroResidue(db, proof);
    await requireRetainedUnchanged(db, proof);
    if (commit) {
      await db.query("COMMIT");
      committed = true;
    }
    return {
      schema: 1,
      committed: commit,
      remaining: commit ? 0 : undefined,
      rehearsalRemaining: commit ? undefined : 0,
      retainedUnchanged: true,
    };
  } finally {
    if (!committed) await db.query("ROLLBACK");
  }
}
