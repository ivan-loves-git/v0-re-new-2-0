"use client"

import { startTransition, useCallback, useOptimistic } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  parseCollectionFilterState,
  serializeCollectionFilterState,
  type CollectionFilterDefinition,
  type CollectionFilterState,
} from "@/lib/collection-filter-state"

interface UseCollectionFiltersOptions {
  definitions: CollectionFilterDefinition[]
  onChange?: () => void
}

export function useCollectionFilters({ definitions, onChange }: UseCollectionFiltersOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlState = parseCollectionFilterState(searchParams, definitions)
  const [state, setOptimisticState] = useOptimistic(
    urlState,
    (_current: CollectionFilterState, next: CollectionFilterState) => next,
  )

  const commit = useCallback(
    (updater: (current: CollectionFilterState) => CollectionFilterState) => {
      const next = updater(state)
      const query = serializeCollectionFilterState(searchParams, next, definitions)
      startTransition(() => {
        setOptimisticState(next)
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
      })
      onChange?.()
    },
    [definitions, onChange, pathname, router, searchParams, setOptimisticState, state],
  )

  const setSearch = useCallback(
    (search: string) => commit((current) => ({ ...current, search })),
    [commit],
  )

  const setFilter = useCallback(
    (key: string, value: string) =>
      commit((current) => ({
        ...current,
        values: { ...current.values, [key]: value },
      })),
    [commit],
  )

  const removeFilter = useCallback((key: string) => setFilter(key, ""), [setFilter])

  const clearFilters = useCallback(
    () => commit((current) => ({
      ...current,
      values: Object.fromEntries(definitions.map((definition) => [definition.key, ""])),
    })),
    [commit, definitions],
  )

  const reset = useCallback(
    () => commit(() => ({
      search: "",
      values: Object.fromEntries(definitions.map((definition) => [definition.key, ""])),
    })),
    [commit, definitions],
  )

  return {
    search: state.search,
    values: state.values,
    setSearch,
    setFilter,
    removeFilter,
    clearFilters,
    reset,
  }
}
