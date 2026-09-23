import type { ReactElement, ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  canonicalGeographyFilterOptions,
  canonicalSectorFilterOptions,
  DealRangeFilters,
} from "@/components/opportunities/repreneur-opportunity-list"
import {
  EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
  filterRepreneurDeals,
} from "@/lib/utils/repreneur-deal-discovery"

const component = readFileSync(
  join(process.cwd(), "components/opportunities/repreneur-opportunity-list.tsx"),
  "utf8",
)

describe("repreneur Deal Flow discovery controls", () => {
  it("keeps taxonomy filters local multi-select controls and exposes usable numeric range controls", () => {
    expect(component).toContain('"geography" | "sector"')
    expect(component).toContain("opportunity.geography_node_id")
    expect(component).toContain('filters[key].includes(option.value)')
    expect(component).toContain("opportunity.canonical_sector")
    expect(component).toContain('aria-label="Minimum revenue"')
    expect(component).toContain('aria-label="Maximum revenue"')
    expect(component).toContain('aria-label="Minimum EBITDA margin"')
    expect(component).toContain('aria-label="Minimum employees"')
    expect(component).toContain('aria-label="Maximum employees"')
    expect(component).toContain("Search title, teaser")
    expect(component).toContain("Confidential acquisition opportunity")
    expect(component).not.toContain("getOpportunityMatchRecommendationLabel")
    expect(component).not.toContain('aria-label={`Position')
  })

  it("keeps clear and reset actions available when only numeric filters are active", () => {
    const onClearFilters = vi.fn()
    const onReset = vi.fn()
    const tree = DealRangeFilters({
      filters: { ...EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS, revenueMin: "1" },
      onChange: vi.fn(),
      onClearFilters,
      onReset,
    })

    const clearButton = findByAriaLabel(tree, "Clear Deal Flow filters")
    const resetButton = findByAriaLabel(tree, "Reset Deal Flow search and filters")

    expect(clearButton).toBeTruthy()
    expect(resetButton).toBeTruthy()
    clearButton?.props.onClick?.()
    resetButton?.props.onClick?.()
    expect(onClearFilters).toHaveBeenCalledOnce()
    expect(onReset).toHaveBeenCalledOnce()
  })

  it("uses one canonical geography label per node instead of legacy locations", () => {
    expect(canonicalGeographyFilterOptions([
      { ...deal(), geography_node_id: "geo-idf", geography_label: "Île-de-France", location: "Paris" },
      { ...deal(), opportunity_id: "other", geography_node_id: "geo-idf", geography_label: "Île-de-France", location: "Ile de France" },
    ])).toEqual([
      { value: "geo-idf", label: "Île-de-France" },
    ])
  })

  it("orders canonical geographies by level and disambiguates duplicate labels", () => {
    const opportunities = [
      { ...deal(), opportunity_id: "unknown", geography_node_id: "geo-unknown", geography_label: "Auvergne" },
      { ...deal(), opportunity_id: "unknown-parent", geography_node_id: "geo-unknown-parent", geography_label: "Auvergne", geography_parent_label: "France" },
      { ...deal(), opportunity_id: "idf-region", geography_node_id: "geo-idf-region", geography_label: "Île-de-France", geography_node_level: "region" as const, geography_parent_label: "Île-de-France" },
      { ...deal(), opportunity_id: "grand-est", geography_node_id: "geo-grand-est", geography_label: "Grand Est", geography_node_level: "macro_zone" as const, geography_parent_label: "France" },
      { ...deal(), opportunity_id: "alsace", geography_node_id: "geo-alsace", geography_label: "Alsace", geography_node_level: "region" as const, geography_parent_label: "Grand Est" },
      { ...deal(), opportunity_id: "france", geography_node_id: "geo-france", geography_label: "France", geography_node_level: "country" as const, geography_parent_label: null },
      { ...deal(), opportunity_id: "idf-macro", geography_node_id: "geo-idf-macro", geography_label: "Île-de-France", geography_node_level: "macro_zone" as const, geography_parent_label: "France" },
    ]
    const expected = [
      { value: "geo-france", label: "France" },
      { value: "geo-grand-est", label: "Grand Est" },
      { value: "geo-idf-macro", label: "Île-de-France — Macro-zone · France" },
      { value: "geo-alsace", label: "Alsace" },
      { value: "geo-idf-region", label: "Île-de-France — Region · Île-de-France" },
      { value: "geo-unknown", label: "Auvergne" },
      { value: "geo-unknown-parent", label: "Auvergne — Parent · France" },
    ]

    expect(canonicalGeographyFilterOptions(opportunities)).toEqual(expected)
    expect(canonicalGeographyFilterOptions([...opportunities].reverse())).toEqual(expected)
  })

  it("keeps canonical node IDs as the filter values after display disambiguation", () => {
    const macro = { ...deal(), opportunity_id: "idf-macro-deal", geography_node_id: "geo-idf-macro", geography_label: "Île-de-France", geography_node_level: "macro_zone" as const, geography_parent_label: "France" }
    const region = { ...deal(), opportunity_id: "idf-region-deal", geography_node_id: "geo-idf-region", geography_label: "Île-de-France", geography_node_level: "region" as const, geography_parent_label: "Île-de-France" }
    const options = canonicalGeographyFilterOptions([region, macro])

    expect(options.map((option) => option.value)).toEqual(["geo-idf-macro", "geo-idf-region"])
    expect(filterRepreneurDeals([macro, region], "", {
      ...EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      geography: [options[1]!.value],
    }).map((opportunity) => opportunity.opportunity_id)).toEqual(["idf-region-deal"])
  })

  it("passes the canonical sector label selected in the UI through to the Deal Flow predicate", () => {
    const opportunity = {
      ...deal(),
      canonical_sector: "Industrie manufacturière",
    }
    const [option] = canonicalSectorFilterOptions([opportunity])

    expect(option).toEqual({
      value: "Industrie manufacturière",
      label: "Industrie manufacturière",
    })
    expect(filterRepreneurDeals([opportunity], "", {
      ...EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      sector: [option.value],
    })).toEqual([opportunity])
  })
})

function deal() {
  return {
    match_id: null,
    match_status: null,
    visible_documents: [],
    opportunity_id: "deal",
    reference: "Confidential opportunity",
    updated_at: "2026-09-02T00:00:00.000Z",
    is_staff_recommended: false,
    is_outside_current_criteria: false,
  }
}

function findByAriaLabel(
  node: ReactNode,
  ariaLabel: string,
): ReactElement<{ "aria-label"?: string; children?: ReactNode; onClick?: () => void }> | null {
  if (!node || typeof node !== "object") return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByAriaLabel(child, ariaLabel)
      if (found) return found
    }
    return null
  }

  const element = node as ReactElement<{ "aria-label"?: string; children?: ReactNode; onClick?: () => void }>
  if (element.props?.["aria-label"] === ariaLabel) return element
  return findByAriaLabel(element.props?.children, ariaLabel)
}
