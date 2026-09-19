import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"
import {
  loadMatchingGeographyContext,
  withMatchingGeography,
  withMatchingGeographyTargets,
} from "@/lib/repreneur-opportunity-geography"

function queryResult(data: unknown, onSelect?: (selection: string) => void) {
  const result = { data, error: null }
  const builder: Record<string, unknown> = {}
  builder.select = (selection: string) => {
    onSelect?.(selection)
    return builder
  }
  builder.in = () => builder
  builder.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return builder
}

describe("Matching v2 geography context", () => {
  it("builds self-to-root paths for opportunities and repreneur targets", async () => {
    const geographySelect = vi.fn()
    const from = vi.fn((table: string) => {
      if (table === "geography_nodes") {
        return queryResult([
          { id: "fr", stable_key: "france", label: "France", node_level: "country", parent_id: null },
          { id: "west", stable_key: "fr-macro-west", label: "Grand Ouest", node_level: "macro_zone", parent_id: "fr" },
          {
            id: "bretagne",
            stable_key: "fr-region-bretagne",
            label: "Bretagne",
            node_level: "region",
            parent_id: "west",
          },
        ], geographySelect)
      }
      if (table === "repreneur_geography_targets") {
        return queryResult([
          { repreneur_id: "repreneur-1", geography_node_id: "west" },
        ])
      }
      throw new Error(`Unexpected table ${table}`)
    })
    const supabase = { from } as unknown as SupabaseClient

    const context = await loadMatchingGeographyContext(supabase, [
      "repreneur-1",
      "repreneur-1",
    ])

    expect(withMatchingGeography(
      { id: "opportunity-1", geography_node_id: "bretagne" },
      context,
    )).toMatchObject({
      geography_path_stable_keys: [
        "fr-region-bretagne",
        "fr-macro-west",
        "france",
      ],
      geography_label: "Bretagne",
      geography_node_level: "region",
      geography_parent_label: "Grand Ouest",
    })
    expect(withMatchingGeographyTargets(
      { id: "repreneur-1" },
      context,
    )).toMatchObject({
      target_geography_paths_stable_keys: [
        ["fr-macro-west", "france"],
      ],
    })
    expect(from).toHaveBeenCalledTimes(2)
    expect(geographySelect).toHaveBeenCalledWith("id, stable_key, label, node_level, parent_id")
  })

  it("does not query target rows when there are no repreneurs", async () => {
    const from = vi.fn((table: string) => {
      if (table !== "geography_nodes") throw new Error(`Unexpected table ${table}`)
      return queryResult([
        { id: "fr", stable_key: "france", label: "France", parent_id: null },
      ])
    })
    const supabase = { from } as unknown as SupabaseClient

    const context = await loadMatchingGeographyContext(supabase, [])

    expect(context.targetPathsByRepreneurId.size).toBe(0)
    expect(from).toHaveBeenCalledTimes(1)
  })

  it("does not expose partial paths from a broken hierarchy", async () => {
    const from = vi.fn((table: string) => {
      if (table === "geography_nodes") {
        return queryResult([
          { id: "orphan", stable_key: "fr-region-orphan", label: "Orphan", parent_id: "missing" },
          { id: "cycle-a", stable_key: "cycle-a", label: "Cycle A", parent_id: "cycle-b" },
          { id: "cycle-b", stable_key: "cycle-b", label: "Cycle B", parent_id: "cycle-a" },
        ])
      }
      if (table === "repreneur_geography_targets") return queryResult([])
      throw new Error(`Unexpected table ${table}`)
    })
    const supabase = { from } as unknown as SupabaseClient

    const context = await loadMatchingGeographyContext(supabase, ["repreneur-1"])

    expect(context.pathByNodeId.has("orphan")).toBe(false)
    expect(context.pathByNodeId.has("cycle-a")).toBe(false)
    expect(context.pathByNodeId.has("cycle-b")).toBe(false)
  })
})
