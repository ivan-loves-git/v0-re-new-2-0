// Roadmap notification status
// Update this date whenever significant roadmap features are added
// The red dot will show on the sidebar for 7 days after this date

export const LAST_ROADMAP_UPDATE = new Date("2026-01-11")

export function hasRecentRoadmapUpdates(): boolean {
  const now = new Date()
  const daysSinceUpdate = Math.floor(
    (now.getTime() - LAST_ROADMAP_UPDATE.getTime()) / (1000 * 60 * 60 * 24)
  )
  return daysSinceUpdate <= 7
}
