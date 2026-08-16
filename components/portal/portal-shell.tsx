"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BriefcaseBusiness, ListTree, LogOut, UserRound, Waves } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PortalShellProps {
  children: React.ReactNode
  userEmail?: string | null
  userName?: string | null
}

const navItems = [
  { name: "Deals", href: "/portal/deals", icon: BriefcaseBusiness },
  { name: "Pursuits", href: "/portal/pursuits", icon: ListTree },
  { name: "Profile", href: "/portal/profile", icon: UserRound },
]

export function PortalShell({ children, userEmail, userName }: PortalShellProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <span className="relative grid size-9 place-items-center rounded-lg bg-[#081020] text-[#7dd3c7]"><Waves className="size-[18px]" /><span aria-hidden="true" className="absolute -bottom-px left-1/2 h-0.5 w-3 -translate-x-1/2 bg-primary" /></span>
            <div className="grid leading-tight"><span className="text-xs font-semibold tracking-[0.12em]">WAVE</span><span className="hidden text-[10px] text-muted-foreground sm:block">Repreneur portal</span></div>
          </div>

          <nav aria-label="Portal" className="flex h-full items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Button key={item.href} asChild variant="ghost" size="sm" className={cn("relative rounded-none px-2 sm:px-3", active && "text-foreground after:absolute after:inset-x-2 after:-bottom-[13px] after:h-0.5 after:bg-primary")}>
                  <Link href={item.href} aria-current={active ? "page" : undefined} aria-label={item.name} className={cn("gap-2", active && "font-semibold")}>
                    <Icon data-icon="inline-start" />
                    <span className="hidden sm:inline">{item.name}</span>
                  </Link>
                </Button>
              )
            })}
            <span className="mx-2 hidden max-w-44 truncate border-l pl-4 text-xs text-muted-foreground lg:inline">
              {userName || userEmail || "Your Re-New space"}
            </span>
            <Button asChild variant="ghost" size="icon-sm" aria-label="Sign out">
              <Link href="/auth/logout" prefetch={false}>
                <LogOut data-icon="inline-start" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
    </div>
  )
}
