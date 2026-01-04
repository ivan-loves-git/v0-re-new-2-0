"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, PanelLeft } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// Map paths to readable names
const pathNames: Record<string, string> = {
  dashboard: "Dashboard",
  repreneurs: "Repreneurs",
  pipeline: "Pipeline",
  emails: "Emails",
  journey: "Journey",
  offers: "Offers",
  guide: "Guide",
  instructions: "Instructions",
  roadmap: "Roadmap",
  todo: "To Do",
  "learnings-test": "Learnings",
  intake: "Intake",
  new: "New",
  edit: "Edit",
  questionnaire: "Questionnaire",
}

export function FloatingNav() {
  const pathname = usePathname()
  const { toggleSidebar, open, isMobile } = useSidebar()

  // Generate breadcrumb items from pathname
  const segments = pathname.split("/").filter(Boolean)

  // Filter out UUID segments and map to readable names
  const breadcrumbItems = segments
    .filter(segment => !/^[0-9a-f-]{36}$/i.test(segment)) // Filter out UUIDs
    .map((segment, index, filtered) => {
      // Find the original index to build correct href
      const originalIndex = segments.findIndex((s, i) =>
        s === segment && segments.slice(0, i).filter(seg => !/^[0-9a-f-]{36}$/i.test(seg)).length === index
      )
      const href = "/" + segments.slice(0, originalIndex + 1).join("/")
      const name = pathNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
      const isLast = index === filtered.length - 1

      return { href, name, isLast }
    })

  return (
    <nav className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
      {/* Sidebar toggle - subtle icon only */}
      <button
        onClick={toggleSidebar}
        className={cn(
          "p-1.5 rounded-md hover:bg-muted transition-colors",
          "text-muted-foreground hover:text-foreground"
        )}
        aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1">
        {breadcrumbItems.map((item, index) => (
          <div key={item.href} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
            {item.isLast ? (
              <span className="text-foreground font-medium">{item.name}</span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.name}
              </Link>
            )}
          </div>
        ))}
      </div>
    </nav>
  )
}
