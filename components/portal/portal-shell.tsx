"use client"

import type React from "react"
import Link from "next/link"
import { PortalNavigationLink } from "@/components/portal/portal-navigation-link"
import { usePathname, useSearchParams } from "next/navigation"
import { BriefcaseBusiness, ListTree, LogOut, MessageSquareText, UserRound, Waves } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LanguageToggle } from "@/components/intake-v2/language-toggle"
import { useUiCopy, useUiLanguage } from "@/components/i18n/ui-text"

interface PortalShellProps {
  children: React.ReactNode
  userEmail?: string | null
  userName?: string | null
}

const navItems = [
  { name: "Deals", href: "/portal/deals", icon: BriefcaseBusiness },
  { name: "Pursuits", href: "/portal/pursuits", icon: ListTree },
  { name: "Profile", href: "/portal/profile", icon: UserRound },
  { name: "Share feedback", href: "/portal/feedback", icon: MessageSquareText },
] as const

export function PortalShell({ children, userEmail, userName }: PortalShellProps) {
  const u = useUiCopy()
  const language = useUiLanguage()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pursuitDetail = pathname.startsWith("/portal/deals/") && searchParams.get("return") === "/portal/pursuits"
  const pursuitReturnParams = new URLSearchParams()
  if (pursuitDetail) {
    const query = searchParams.get("q")
    const status = searchParams.get("status")
    if (query) pursuitReturnParams.set("q", query.slice(0, 120))
    if (status === "active" || status === "awaiting" || status === "ended") pursuitReturnParams.set("status", status)
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <span className="relative grid size-9 place-items-center rounded-lg bg-foreground text-background"><Waves className="size-[18px]" /><span aria-hidden="true" className="absolute -bottom-px left-1/2 h-0.5 w-3 -translate-x-1/2 bg-background" /></span>
              <div className="grid leading-tight"><span className="text-xs font-semibold tracking-[0.12em]">WAVE</span><span className="hidden text-[10px] text-muted-foreground sm:block">{u("Repreneur portal")}</span></div>
          </div>

          <nav aria-label={u("Portal")} className="flex h-full items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = (pathname === item.href || pathname.startsWith(`${item.href}/`))
                ? !(pursuitDetail && item.href === "/portal/deals")
                : pursuitDetail && item.href === "/portal/pursuits"
              const href = item.href === "/portal/pursuits" && pursuitDetail && pursuitReturnParams.size
                ? `${item.href}?${pursuitReturnParams}` : item.href
              const label = item.name === "Share feedback"
                ? language === "fr" ? "Votre avis" : "Share feedback"
                : u(item.name)
              return (
                <Button key={item.href} asChild variant="ghost" size="sm" className={cn("relative rounded-none px-2 sm:px-3", active && "text-foreground after:absolute after:inset-x-2 after:-bottom-[13px] after:h-0.5 after:bg-primary")}>
                  <PortalNavigationLink href={href} aria-current={active ? "page" : undefined} aria-label={label} className={cn("gap-2", active && "font-semibold")}>
                    <Icon data-icon="inline-start" />
                    <span className="hidden sm:inline">{label}</span>
                  </PortalNavigationLink>
                </Button>
              )
            })}
            <span className="mx-2 hidden max-w-44 truncate border-l pl-4 text-xs text-muted-foreground lg:inline">
              {userName || userEmail || u("Your Re-New space")}
            </span>
            <Button asChild variant="ghost" size="icon-sm" aria-label={u("Sign out")}>
              <Link href="/auth/logout" prefetch={false}>
                <LogOut data-icon="inline-start" />
              </Link>
            </Button>
          </nav>
        </div>
        <div className="mx-auto flex w-full max-w-7xl justify-end border-t px-4 py-2 md:px-6"><LanguageToggle /></div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
    </div>
  )
}
