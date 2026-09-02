import type { SupabaseClient } from "@supabase/supabase-js"

type GeographyNodeRow = {
  id: string
  stable_key: string
  label: string
  parent_id: string | null
}

type GeographyTargetRow = {
  repreneur_id: string
  geography_node_id: string
}

export type MatchingGeographyContext = {
  pathByNodeId: Map<string, string[]>
  labelByNodeId: Map<string, string>
  targetPathsByRepreneurId: Map<string, string[][]>
}

function buildGeographyPaths(nodes: GeographyNodeRow[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const pathByNodeId = new Map<string, string[]>()

  for (const node of nodes) {
    const path: string[] = []
    const visited = new Set<string>()
    let current: GeographyNodeRow | undefined = node
    let isComplete = true

    while (current) {
      if (visited.has(current.id)) {
        isComplete = false
        break
      }
      visited.add(current.id)
      path.push(current.stable_key)
      if (!current.parent_id) break

      const parent = nodeById.get(current.parent_id)
      if (!parent) {
        isComplete = false
        break
      }
      current = parent
    }

    if (isComplete) pathByNodeId.set(node.id, path)
  }

  return pathByNodeId
}

/**
 * Loads only the staff-only France hierarchy identities used by deterministic
 * matching. Literal opportunity locations remain unchanged for display.
 */
export async function loadMatchingGeographyContext(
  supabase: SupabaseClient,
  repreneurIds: string[],
): Promise<MatchingGeographyContext> {
  const uniqueRepreneurIds = [...new Set(repreneurIds.filter(Boolean))]
  const [nodesResult, targetsResult] = await Promise.all([
    supabase.from("geography_nodes").select("id, stable_key, label, parent_id"),
    uniqueRepreneurIds.length > 0
      ? supabase
          .from("repreneur_geography_targets")
          .select("repreneur_id, geography_node_id")
          .in("repreneur_id", uniqueRepreneurIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (nodesResult.error) throw new Error(nodesResult.error.message)
  if (targetsResult.error) throw new Error(targetsResult.error.message)

  const pathByNodeId = buildGeographyPaths(
    (nodesResult.data ?? []) as GeographyNodeRow[],
  )
  const labelByNodeId = new Map(
    ((nodesResult.data ?? []) as GeographyNodeRow[]).map((node) => [node.id, node.label]),
  )
  const targetPathsByRepreneurId = new Map<string, string[][]>()

  for (const target of (targetsResult.data ?? []) as GeographyTargetRow[]) {
    const targetPath = pathByNodeId.get(target.geography_node_id)
    if (!targetPath) continue

    const paths = targetPathsByRepreneurId.get(target.repreneur_id) ?? []
    if (!paths.some((path) => path[0] === targetPath[0])) {
      paths.push(targetPath)
      targetPathsByRepreneurId.set(target.repreneur_id, paths)
    }
  }

  return { pathByNodeId, labelByNodeId, targetPathsByRepreneurId }
}

export function withMatchingGeography<
  T extends { geography_node_id?: string | null },
>(opportunity: T, context: MatchingGeographyContext) {
  return {
    ...withRepreneurGeographyLabel(opportunity, context),
    geography_path_stable_keys: opportunity.geography_node_id
      ? context.pathByNodeId.get(opportunity.geography_node_id) ?? []
      : undefined,
  }
}

/**
 * The portal needs the approved taxonomy label for filtering, but never the
 * matching hierarchy path or other staff-only geography context.
 */
export function withRepreneurGeographyLabel<
  T extends { geography_node_id?: string | null },
>(opportunity: T, context: MatchingGeographyContext) {
  return {
    ...opportunity,
    geography_label: opportunity.geography_node_id
      ? context.labelByNodeId.get(opportunity.geography_node_id) ?? null
      : null,
  }
}

export function withMatchingGeographyTargets<T extends { id: string }>(
  repreneur: T,
  context: MatchingGeographyContext,
) {
  return {
    ...repreneur,
    target_geography_paths_stable_keys:
      context.targetPathsByRepreneurId.get(repreneur.id) ?? [],
  }
}
