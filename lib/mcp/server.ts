import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { WaveCatalog } from "@/lib/mcp/catalog"
import { QueryRejected } from "@/lib/mcp/data-exposure"
import {
  DEFAULT_ROW_LIMIT,
  FILTER_OPERATORS,
  MAX_ROW_LIMIT,
  RowReadFailed,
  formatRowPage,
  planRowQuery,
  type RowReader,
} from "@/lib/mcp/read-rows"

export const WAVE_MCP_INSTRUCTIONS = `WAVE is Re-New's M&A platform. This connection is read-only: it can look at every business record a WAVE staff member can see, and it can never change anything.

How to work:
1. Call list_tables to see what exists, then describe_table before querying a table you have not used yet.
2. Use query_table with filters, order and limit. Search text with the ilike operator and a pattern such as "%dupont%".
3. Embed related records in select, for example "id, name, ma_offices(name, city)". describe_table shows which tables can be embedded.
4. Results are paged (default ${DEFAULT_ROW_LIMIT}, maximum ${MAX_ROW_LIMIT} rows). Continue with next_offset when you need more.

Main records: opportunities (businesses for sale and their lifecycle), repreneurs (buyers), opportunity_matches (buyer-to-opportunity matching), offers, ma_firms -> ma_offices -> ma_contacts (via ma_contact_office_affiliations), ma_interactions (activity with offices and contacts), external_pursuits, email_logs, tasks and notes. Records marked DEMO are fictional test data.

Login data, credentials and the retired Strategic PDR are never available here. Treat everything you read as confidential Re-New client information.`

export interface WaveMcpContext {
  catalog: WaveCatalog
  readRows: RowReader
  /** Records which staff member used which tool on which table; never record content. */
  audit: (event: { tool: string; table?: string; outcome: "ok" | "rejected" | "failed" }) => void
}

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] }
}

function failure(value: string) {
  return { ...text(value), isError: true }
}

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

const filterValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number()])),
])

export function createWaveMcpServer({ catalog, readRows, audit }: WaveMcpContext) {
  const server = new McpServer(
    { name: "wave", title: "Re-New WAVE (read-only)", version: "1.0.0" },
    { instructions: WAVE_MCP_INSTRUCTIONS },
  )

  server.registerTool(
    "list_tables",
    {
      title: "List WAVE tables",
      description:
        "Lists every readable WAVE table and view with its approximate row count. Start here.",
      annotations: readOnly,
    },
    async () => {
      const tables = await catalog.listTables().catch((error: unknown) => {
        audit({ tool: "list_tables", outcome: "failed" })
        throw error
      })
      audit({ tool: "list_tables", outcome: "ok" })
      return text(
        JSON.stringify(
          tables.map((table) => ({
            name: table.name,
            kind: table.kind,
            approximate_rows: table.approximateRows,
            ...(table.description ? { description: table.description } : {}),
          })),
        ),
      )
    },
  )

  server.registerTool(
    "describe_table",
    {
      title: "Describe a WAVE table",
      description:
        "Shows a table's columns, types, primary key, the tables its columns reference and the tables that reference it (both can be embedded in query_table's select).",
      inputSchema: { table: z.string().describe("Table name from list_tables.") },
      annotations: readOnly,
    },
    async ({ table }) => {
      const description = await catalog.describeTable(table).catch((error: unknown) => {
        audit({ tool: "describe_table", table, outcome: "failed" })
        throw error
      })
      if (!description) {
        audit({ tool: "describe_table", table, outcome: "rejected" })
        return failure(`"${table}" is not a readable table. Call list_tables to see what exists.`)
      }
      audit({ tool: "describe_table", table, outcome: "ok" })
      return text(JSON.stringify(description))
    },
  )

  server.registerTool(
    "query_table",
    {
      title: "Read rows from a WAVE table",
      description:
        "Reads rows from one table with optional filters, ordering, paging and embedded related tables. Returns total_rows and next_offset for paging.",
      inputSchema: {
        table: z.string().describe("Table name from list_tables."),
        select: z
          .string()
          .optional()
          .describe(
            'PostgREST select list. Default "*". Examples: "id, name, created_at" or "*, ma_offices(name, city)". Alias with alias:column.',
          ),
        filters: z
          .array(
            z.object({
              column: z
                .string()
                .describe("column, related_table.column, or json_column->>key"),
              operator: z.enum(FILTER_OPERATORS),
              value: filterValue
                .optional()
                .describe(
                  'One value; a list for "in" and "contains"; null/true/false for "is" and "is_not"; a pattern with % for like/ilike.',
                ),
            }),
          )
          .optional()
          .describe("All filters must match (AND)."),
        order: z
          .array(
            z.object({
              column: z.string(),
              ascending: z.boolean().optional(),
              nulls_first: z.boolean().optional(),
            }),
          )
          .optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_ROW_LIMIT)
          .optional()
          .describe(`Rows to return, default ${DEFAULT_ROW_LIMIT}, maximum ${MAX_ROW_LIMIT}.`),
        offset: z.number().int().min(0).optional().describe("Rows to skip, for paging."),
      },
      annotations: readOnly,
    },
    async (input) => {
      try {
        const plan = planRowQuery(input, await catalog.exposedTableNames())
        const page = await readRows(plan)
        audit({ tool: "query_table", table: plan.table, outcome: "ok" })
        return text(formatRowPage(plan, page))
      } catch (error) {
        if (error instanceof QueryRejected) {
          audit({ tool: "query_table", table: input.table, outcome: "rejected" })
          return failure(error.message)
        }
        audit({ tool: "query_table", table: input.table, outcome: "failed" })
        if (error instanceof RowReadFailed) {
          return failure(`WAVE could not run this query: ${error.message}`)
        }
        throw error
      }
    },
  )

  return server
}
