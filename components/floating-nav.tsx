"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, PanelLeft } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// Map paths to readable names
const pathNames: Record<string, string> = {
  dashboard: "Dashboard",
  dashboard_re: "Dashboard",
  dashboard_op: "Dashboard",
  analytics: "Analytics",
  analytics_re: "Analytics",
  analytics_op: "Analytics",
  repreneurs: "Repreneurs",
  opportunities: "Opportunities",
  ma: "M&A",
  activity: "Activity",
  firms: "Firms",
  contacts: "Contacts",
  pipeline: "Pipeline",
  emails: "Emails",
  journey: "Journey",
  offers: "Offers",
  guide: "Guide",
  instructions: "Instructions",
  roadmap: "Roadmap",
  guidelines: "Guidelines",
  todo: "To Do",
  "learnings-test": "Learnings",
  intake: "Intake",
  new: "New",
  edit: "Edit",
  questionnaire: "Questionnaire",
}

const topLevelContexts: Record<string, { name: string; href: string }> = {
  dashboard_re: { name: "Repreneurs", href: "/repreneurs" },
  analytics_re: { name: "Repreneurs", href: "/repreneurs" },
  pipeline: { name: "Repreneurs", href: "/repreneurs" },
  offers: { name: "Repreneurs", href: "/repreneurs" },
  dashboard_op: { name: "Opportunities", href: "/opportunities/groups" },
  analytics_op: { name: "Opportunities", href: "/opportunities/groups" },
}

export function FloatingNav() {
  const pathname = usePathname()
  const { toggleSidebar, open, isMobile } = useSidebar()

  const segments = pathname.split("/").filter(Boolean)
  const maDetailKind =
    segments[0] === "opportunities" &&
    segments[1] === "ma" &&
    (segments[2] === "firms" || segments[2] === "offices") &&
    /^[0-9a-f-]{36}$/i.test(segments[3] ?? "")
      ? segments[2]
      : null

  const breadcrumbItems = maDetailKind
    ? [
        {
          href: "/opportunities",
          name: "Opportunities",
          isLast: false,
        },
        { href: "/opportunities/ma", name: "M&A", isLast: false },
        {
          href: "/opportunities/ma/firms",
          name: "Firms",
          isLast: false,
        },
        {
          href: pathname,
          name: maDetailKind === "firms" ? "Firm detail" : "Office detail",
          isLast: true,
        },
      ]
    : segments
        .filter((segment) => !/^[0-9a-f-]{36}$/i.test(segment))
        .map((segment, index, filtered) => {
          const originalIndex = segments.findIndex(
            (s, i) =>
              s === segment &&
              segments
                .slice(0, i)
                .filter((seg) => !/^[0-9a-f-]{36}$/i.test(seg)).length ===
                index,
          )
          const href = "/" + segments.slice(0, originalIndex + 1).join("/")
          const name =
            pathNames[segment] ||
            segment.charAt(0).toUpperCase() + segment.slice(1)
          const isLast = index === filtered.length - 1

          return { href, name, isLast }
        })
  const contextualRoot =
    segments.length === 1 ? topLevelContexts[segments[0]] : undefined
  const visibleBreadcrumbItems = contextualRoot
    ? [{ ...contextualRoot, isLast: false }, ...breadcrumbItems]
    : breadcrumbItems

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b bg-card/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/90 md:px-5">
      <button
        onClick={toggleSidebar}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-muted",
          "text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label={
          isMobile
            ? "Open navigation"
            : open
              ? "Collapse sidebar"
              : "Expand sidebar"
        }
      >
        <PanelLeft className="size-4" />
      </button>

      <nav
        aria-label="Breadcrumb"
        className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ol className="flex min-w-max items-center gap-1 text-xs text-muted-foreground">
          {visibleBreadcrumbItems.map((item, index) => (
            <li key={item.href} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="size-3.5 text-muted-foreground/50" />
              )}
              {item.isLast ? (
                <span
                  aria-current="page"
                  className="font-semibold text-foreground"
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="transition-colors hover:text-foreground"
                >
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <span className="wave-micro-label ml-auto hidden shrink-0 font-mono sm:inline">
        Re-New workspace
      </span>
    </header>
  )
}
