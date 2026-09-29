import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  canonicalGeographyFilterOptions,
  canonicalSectorFilterOptions,
  DealRangeFilters,
  normalizeSavedGeographySelection,
} from "@/components/opportunities/repreneur-opportunity-list"
import {
  EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
  filterRepreneurDeals,
} from "@/lib/utils/repreneur-deal-discovery"
import { LanguageProvider } from "@/lib/i18n/language-context"

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
    expect(component).toContain('aria-label={u("Minimum revenue")}')
    expect(component).toContain('aria-label={u("Maximum revenue")}')
    expect(component).toContain('aria-label={u("Minimum EBITDA margin")}')
    expect(component).toContain('aria-label={u("Minimum employees")}')
    expect(component).toContain('aria-label={u("Maximum employees")}')
    expect(component).toContain("Search title, teaser")
    expect(component).toContain("Confidential acquisition opportunity")
    expect(component).not.toContain("getOpportunityMatchRecommendationLabel")
    expect(component).not.toContain('aria-label={`Position')
  })

  it("renders clear and reset controls for numeric-only filters in both interface languages", () => {
    const render = (language: "fr" | "en", revenueMin: string) => renderToStaticMarkup(
      createElement(LanguageProvider, { initialLanguage: language }, createElement(DealRangeFilters, {
        filters: { ...EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS, revenueMin },
        onChange: () => {}, onClearFilters: () => {}, onReset: () => {},
      })),
    )
    const english = render("en", "1")
    const french = render("fr", "1")
    expect(english).toContain('aria-label="Clear Deal Flow filters"')
    expect(english).toContain('aria-label="Reset Deal Flow search and filters"')
    expect(french).toContain('aria-label="Effacer les filtres des opportunités"')
    expect(french).toContain('aria-label="Réinitialiser la recherche et les filtres"')
    expect(french).toContain('aria-label="Chiffre d’affaires minimum"')
    expect(french).toContain('placeholder="Min."')
    expect(english).toContain('placeholder="Min"')
    expect(render("fr", "")).not.toContain('aria-label="Effacer les filtres des opportunités"')
    expect(component).toContain('onClick={onClearFilters}')
    expect(component).toContain('onClick={onReset}')
  })

  it("uses one canonical geography label per node instead of legacy locations", () => {
    expect(canonicalGeographyFilterOptions([
      { ...deal(), geography_node_id: "geo-idf", geography_label: "Île-de-France", location: "Paris" },
      { ...deal(), opportunity_id: "other", geography_node_id: "geo-idf", geography_label: "Île-de-France", location: "Ile de France" },
    ])).toEqual([
      { value: "geo-idf", label: "Île-de-France" },
    ])
  })

  it("offers canonical ancestors and only one Île-de-France area from portal-safe taxonomy nodes", () => {
    const country = { id: "fr", label: "France", nodeLevel: "country" as const, parentLabel: null }
    const idf = { id: "idf-macro", label: "Île-de-France", nodeLevel: "macro_zone" as const, parentLabel: "France", equivalentNodeIds: ["idf-region"] }
    const west = { id: "west", label: "Grand Ouest", nodeLevel: "macro_zone" as const, parentLabel: "France" }
    const bretagne = { id: "bretagne", label: "Bretagne", nodeLevel: "region" as const, parentLabel: "Grand Ouest" }
    const options = canonicalGeographyFilterOptions([
      { ...deal(), opportunity_id: "idf-macro-deal", geography_node_id: "idf-macro", geography_filter_nodes: [idf, country] },
      { ...deal(), opportunity_id: "idf-region-deal", geography_node_id: "idf-region", geography_filter_nodes: [idf, country] },
      { ...deal(), opportunity_id: "bretagne-deal", geography_node_id: "bretagne", geography_filter_nodes: [bretagne, west, country] },
    ])

    expect(options).toEqual([
      { value: "fr", label: "France" },
      { value: "west", label: "Grand Ouest" },
      { value: "idf-macro", label: "Île-de-France", equivalentValues: ["idf-region"] },
      { value: "bretagne", label: "Brittany" },
    ])
    expect(canonicalGeographyFilterOptions([
      { ...deal(), geography_node_id: "bretagne", geography_label: "Bretagne" },
    ], "fr")).toEqual([{ value: "bretagne", label: "Bretagne" }])
  })

  it("restores either old IDF selection as the one current option and drops stale IDs", () => {
    const options = [
      { value: "fr", label: "France" },
      { value: "idf-macro", label: "Île-de-France", equivalentValues: ["idf-region"] },
    ]

    expect(normalizeSavedGeographySelection(["idf-region"], options)).toEqual(["idf-macro"])
    expect(normalizeSavedGeographySelection(["idf-macro", "idf-region", "stale"], options)).toEqual(["idf-macro"])
    expect(normalizeSavedGeographySelection(["fr", "idf-region"], options)).toEqual(["fr", "idf-macro"])
    expect(normalizeSavedGeographySelection("idf-region", options)).toEqual([])
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
