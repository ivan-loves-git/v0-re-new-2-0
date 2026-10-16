import type { SupabaseClient } from "@supabase/supabase-js"
import {
  QueryRejected,
  redactSecrets,
  validateColumnPath,
  validateSelect,
} from "@/lib/mcp/data-exposure"

export const FILTER_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "in",
  "is",
  "is_not",
  "contains",
] as const

export type FilterOperator = (typeof FILTER_OPERATORS)[number]
type Scalar = string | number | boolean

export interface RowFilterInput {
  column: string
  operator: FilterOperator
  value?: Scalar | null | Array<string | number>
}

export interface RowOrderInput {
  column: string
  ascending?: boolean
  nulls_first?: boolean
}

export interface RowQueryInput {
  table: string
  select?: string
  filters?: RowFilterInput[]
  order?: RowOrderInput[]
  limit?: number
  offset?: number
}

export type PlannedFilter =
  | { column: string; operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; value: Scalar }
  | { column: string; operator: "like" | "ilike"; value: string }
  | { column: string; operator: "in" | "contains"; value: Array<string | number> }
  | { column: string; operator: "is" | "is_not"; value: boolean | null }

export interface RowQueryPlan {
  table: string
  select: string
  filters: PlannedFilter[]
  order: Array<{ column: string; referencedTable?: string; ascending: boolean; nullsFirst: boolean }>
  limit: number
  offset: number
}

export const DEFAULT_ROW_LIMIT = 50
export const MAX_ROW_LIMIT = 1000
const MAX_FILTERS = 20
const MAX_ORDER_COLUMNS = 5
const MAX_LIST_VALUES = 200

function planFilter(filter: RowFilterInput, exposed: ReadonlySet<string>): PlannedFilter {
  const column = validateColumnPath(filter.column, exposed)
  const { operator, value } = filter
  switch (operator) {
    case "eq":
    case "neq":
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      if (value === null || value === undefined || Array.isArray(value)) {
        throw new QueryRejected(`${operator} on "${column}" needs one value. Use "is" for null.`)
      }
      return { column, operator, value }
    case "like":
    case "ilike":
      if (typeof value !== "string") {
        throw new QueryRejected(`${operator} on "${column}" needs a text pattern such as "%dupont%".`)
      }
      return { column, operator, value }
    case "in":
    case "contains":
      if (!Array.isArray(value) || value.length === 0 || value.length > MAX_LIST_VALUES) {
        throw new QueryRejected(`${operator} on "${column}" needs a list of 1 to ${MAX_LIST_VALUES} values.`)
      }
      return { column, operator, value }
    case "is":
    case "is_not":
      if (value !== null && typeof value !== "boolean") {
        throw new QueryRejected(`${operator} on "${column}" accepts only null, true or false.`)
      }
      return { column, operator, value }
  }
}

/** Validates a staff query against the exposure rules before anything is read. */
export function planRowQuery(input: RowQueryInput, exposed: ReadonlySet<string>): RowQueryPlan {
  if (!exposed.has(input.table)) {
    throw new QueryRejected(`"${input.table}" is not a readable table. Call list_tables to see what exists.`)
  }
  const filters = input.filters ?? []
  if (filters.length > MAX_FILTERS) {
    throw new QueryRejected(`Use at most ${MAX_FILTERS} filters per query.`)
  }
  const limit = Math.trunc(input.limit ?? DEFAULT_ROW_LIMIT)
  const offset = Math.trunc(input.offset ?? 0)
  if (!(limit >= 1 && limit <= MAX_ROW_LIMIT)) {
    throw new QueryRejected(`limit must be between 1 and ${MAX_ROW_LIMIT}.`)
  }
  if (!(offset >= 0)) throw new QueryRejected("offset must be 0 or more.")
  const order = input.order ?? []
  if (order.length > MAX_ORDER_COLUMNS) {
    throw new QueryRejected(`Order by at most ${MAX_ORDER_COLUMNS} columns.`)
  }

  return {
    table: input.table,
    select: validateSelect(input.select, exposed),
    filters: filters.map((filter) => planFilter(filter, exposed)),
    order: order.map((entry) => {
      const path = validateColumnPath(entry.column, exposed)
      const [referencedTable, column] = path.includes(".") ? path.split(".", 2) : [undefined, path]
      return {
        column,
        referencedTable,
        ascending: entry.ascending ?? true,
        nullsFirst: entry.nulls_first ?? false,
      }
    }),
    limit,
    offset,
  }
}

export class RowReadFailed extends Error {}

export interface RowPage {
  rows: unknown[]
  total: number | null
}

export type RowReader = (plan: RowQueryPlan) => Promise<RowPage>

/** Executes a validated plan as one PostgREST read. Nothing here can write. */
export function createSupabaseRowReader(client: SupabaseClient): RowReader {
  return async (plan) => {
    let query = client
      .from(plan.table)
      .select(plan.select, { count: "exact" })
    for (const filter of plan.filters) {
      switch (filter.operator) {
        case "eq":
          query = query.eq(filter.column, filter.value)
          break
        case "neq":
          query = query.neq(filter.column, filter.value)
          break
        case "gt":
          query = query.gt(filter.column, filter.value)
          break
        case "gte":
          query = query.gte(filter.column, filter.value)
          break
        case "lt":
          query = query.lt(filter.column, filter.value)
          break
        case "lte":
          query = query.lte(filter.column, filter.value)
          break
        case "like":
          query = query.like(filter.column, filter.value)
          break
        case "ilike":
          query = query.ilike(filter.column, filter.value)
          break
        case "in":
          query = query.in(filter.column, filter.value)
          break
        case "contains":
          query = query.contains(filter.column, filter.value)
          break
        case "is":
          query = query.is(filter.column, filter.value)
          break
        case "is_not":
          query = query.not(filter.column, "is", filter.value)
          break
      }
    }
    for (const entry of plan.order) {
      query = query.order(entry.column, {
        ascending: entry.ascending,
        nullsFirst: entry.nullsFirst,
        ...(entry.referencedTable ? { referencedTable: entry.referencedTable } : {}),
      })
    }
    const { data, error, count } = await query.range(
      plan.offset,
      plan.offset + plan.limit - 1,
    )
    if (error) throw new RowReadFailed(error.message)
    return { rows: (data as unknown[] | null) ?? [], total: count ?? null }
  }
}

// Claude Code refuses MCP results above about 25,000 tokens by default.
export const MAX_RESULT_CHARACTERS = 60_000

/**
 * Serializes a page for Claude with secrets removed. Wide rows are cut from
 * the end so one answer fits Claude's limit; `next_offset` continues paging.
 */
export function formatRowPage(plan: RowQueryPlan, page: RowPage) {
  const rows = redactSecrets(page.rows) as unknown[]
  const render = (count: number) => {
    const truncated = count < rows.length
    const more = truncated || (page.total !== null && plan.offset + count < page.total)
    return JSON.stringify({
      table: plan.table,
      total_rows: page.total,
      offset: plan.offset,
      returned_rows: count,
      ...(truncated ? { truncated: true } : {}),
      next_offset: more ? plan.offset + count : null,
      rows: rows.slice(0, count),
    })
  }

  let count = rows.length
  let text = render(count)
  while (text.length > MAX_RESULT_CHARACTERS && count > 1) {
    count = Math.max(1, Math.floor(count * (MAX_RESULT_CHARACTERS / text.length) * 0.9))
    text = render(count)
  }
  return text
}
