import type { SupabaseClient } from "@supabase/supabase-js"
import type { RepreneurGeographyFilterNode } from "@/lib/types/opportunity"

type GeographyNodeRow = {
  id: string
  stable_key: string
  label: string
  node_level: string | null
  parent_id: string | null
}

type GeographyTargetRow = {
  repreneur_id: string
  geography_node_id: string
}

export type MatchingGeographyContext = {
  pathByNodeId: Map<string, string[]>
  labelByNodeId: Map<string, string>
  nodeLevelByNodeId: Map<string, "country" | "macro_zone" | "region">
  parentLabelByNodeId: Map<string, string>
  portalFilterNodesByNodeId: Map<string, RepreneurGeographyFilterNode[]>
  targetPathsByRepreneurId: Map<string, string[][]>
}

function isGeographyNodeLevel(
  value: string | null,
): value is "country" | "macro_zone" | "region" {
  return value === "country" || value === "macro_zone" || value === "region"
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

function buildPortalFilterNodes(nodes: GeographyNodeRow[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const idfMacro = nodes.find((node) => node.stable_key === "fr-macro-idf" && node.node_level === "macro_zone")
  const idfRegion = nodes.find((node) => node.stable_key === "fr-region-idf" && node.node_level === "region")
  // These two approved canonical identities currently describe the same area.
  // Require the actual parent edge and sole child, not an equal label or IDF code.
  const equivalentIdf = Boolean(idfMacro && idfRegion
    && idfRegion.parent_id === idfMacro.id
    && nodes.filter((node) => node.parent_id === idfMacro.id).length === 1)
  const portalFilterNodesByNodeId = new Map<string, RepreneurGeographyFilterNode[]>()

  for (const node of nodes) {
    const path: RepreneurGeographyFilterNode[] = []
    const visited = new Set<string>()
    let current: GeographyNodeRow | undefined = node
    let complete = true

    while (current) {
      if (visited.has(current.id)) {
        complete = false
        break
      }
      visited.add(current.id)
      if (!equivalentIdf || current.id !== idfRegion?.id) {
        const parent = current.parent_id ? nodeById.get(current.parent_id) : null
        path.push({
          id: current.id,
          label: current.label,
          nodeLevel: isGeographyNodeLevel(current.node_level) ? current.node_level : null,
          parentLabel: parent?.label ?? null,
          ...(equivalentIdf && current.id === idfMacro?.id
            ? { equivalentNodeIds: [idfRegion!.id] }
            : {}),
        })
      }
      if (!current.parent_id) break
      current = nodeById.get(current.parent_id)
      if (!current) complete = false
    }

    if (complete) portalFilterNodesByNodeId.set(node.id, path)
  }

  return portalFilterNodesByNodeId
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
    supabase.from("geography_nodes").select("id, stable_key, label, node_level, parent_id"),
    uniqueRepreneurIds.length > 0
      ? supabase
          .from("repreneur_geography_targets")
          .select("repreneur_id, geography_node_id")
          .in("repreneur_id", uniqueRepreneurIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (nodesResult.error) throw new Error(nodesResult.error.message)
  if (targetsResult.error) throw new Error(targetsResult.error.message)

  const nodes = (nodesResult.data ?? []) as GeographyNodeRow[]
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const pathByNodeId = buildGeographyPaths(nodes)
  const portalFilterNodesByNodeId = buildPortalFilterNodes(nodes)
  const labelByNodeId = new Map(
    nodes.map((node) => [node.id, node.label]),
  )
  const nodeLevelByNodeId = new Map(
    nodes.flatMap((node) => isGeographyNodeLevel(node.node_level)
      ? [[node.id, node.node_level] as const]
      : []),
  )
  const parentLabelByNodeId = new Map(
    nodes.flatMap((node) => {
      const parentLabel = node.parent_id ? nodeById.get(node.parent_id)?.label : null
      return parentLabel ? [[node.id, parentLabel] as const] : []
    }),
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

  return {
    pathByNodeId,
    labelByNodeId,
    nodeLevelByNodeId,
    parentLabelByNodeId,
    portalFilterNodesByNodeId,
    targetPathsByRepreneurId,
  }
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
    geography_node_level: opportunity.geography_node_id
      ? context.nodeLevelByNodeId.get(opportunity.geography_node_id) ?? null
      : null,
    geography_parent_label: opportunity.geography_node_id
      ? context.parentLabelByNodeId.get(opportunity.geography_node_id) ?? null
      : null,
    geography_filter_nodes: opportunity.geography_node_id
      ? context.portalFilterNodesByNodeId.get(opportunity.geography_node_id) ?? []
      : [],
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
