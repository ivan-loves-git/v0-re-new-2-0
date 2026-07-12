export interface CollectionFilterOption {
  value: string
  label: string
}

export interface CollectionFilterDefinition {
  key: string
  label: string
  options: readonly CollectionFilterOption[]
}

export type CollectionFilterValues = Record<string, string>

export interface CollectionFilterState {
  search: string
  values: CollectionFilterValues
}

export function parseCollectionFilterState(
  searchParams: Pick<URLSearchParams, "get">,
  definitions: CollectionFilterDefinition[],
): CollectionFilterState {
  const values = Object.fromEntries(
    definitions.map((definition) => {
      const candidate = searchParams.get(definition.key) ?? ""
      const isValid = definition.options.some((option) => option.value === candidate)
      return [definition.key, isValid ? candidate : ""]
    }),
  )

  return {
    search: searchParams.get("q")?.trim() ?? "",
    values,
  }
}

export function serializeCollectionFilterState(
  currentSearchParams: Pick<URLSearchParams, "toString">,
  state: CollectionFilterState,
  definitions: CollectionFilterDefinition[],
) {
  const params = new URLSearchParams(currentSearchParams.toString())
  const search = state.search.trim()

  if (search) params.set("q", search)
  else params.delete("q")

  definitions.forEach((definition) => {
    const value = state.values[definition.key]
    if (value) params.set(definition.key, value)
    else params.delete(definition.key)
  })

  params.sort()
  return params.toString()
}

export function getCollectionFilterLabel(
  definition: CollectionFilterDefinition,
  value: string,
) {
  return definition.options.find((option) => option.value === value)?.label ?? value
}
