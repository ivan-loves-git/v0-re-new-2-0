import { describe, expect, it } from "vitest"
import {
  parseCollectionFilterState,
  serializeCollectionFilterState,
  type CollectionFilterDefinition,
} from "@/lib/collection-filter-state"

const definitions: CollectionFilterDefinition[] = [
  { key: "status", label: "Status", options: [{ value: "lead", label: "Lead" }] },
  { key: "journey", label: "Journey", options: [{ value: "ready", label: "Ready" }] },
]

describe("collection filter URL state", () => {
  it("parses known values and rejects stale values", () => {
    const state = parseCollectionFilterState(new URLSearchParams("q=Anne&status=lead&journey=retired"), definitions)
    expect(state).toEqual({ search: "Anne", values: { status: "lead", journey: "" } })
  })

  it("serializes in stable order while preserving unrelated state", () => {
    const query = serializeCollectionFilterState(
      new URLSearchParams("page=2&old=value"),
      { search: "  buyer  ", values: { status: "lead", journey: "" } },
      definitions,
    )
    expect(query).toBe("old=value&page=2&q=buyer&status=lead")
  })
})
