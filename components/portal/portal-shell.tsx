"use client"

import type React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { BriefcaseBusiness, LogOut, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PortalShellProps {
  children: React.ReactNode
  userEmail?: string | null
  userName?: string | null
}

const navItems = [
  { name: "Deals", href: "/portal/deals", icon: BriefcaseBusiness },
  { name: "Profile", href: "/portal/profile", icon: UserRound },
]

export function PortalShell({ children, userEmail, userName }: PortalShellProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <Image src="/wave-logo.png" alt="Re-New" width={120} height={40} className="h-auto" style={{ width: "auto" }} priority />
            <div className="hidden flex-col md:flex">
              <span className="text-sm font-medium">Repreneur portal</span>
              <span className="text-xs text-muted-foreground">{userName || userEmail || "Your Re-New space"}</span>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Button key={item.href} asChild variant={active ? "secondary" : "ghost"} size="sm">
                  <Link href={item.href} className={cn("gap-2", active && "font-medium")}>
                    <Icon data-icon="inline-start" />
                    {item.name}
                  </Link>
                </Button>
              )
            })}
            <Button asChild variant="outline" size="sm">
              <Link href="/auth/logout">
                <LogOut data-icon="inline-start" />
                Sign out
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
        {children}
      </main>
    </div>
  )
}
