"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  FolderKanban,
  Search,
  GitBranch,
  Mail,
  Package,
  BarChart3,
  Gauge,
  BookOpenCheck,
  Map,
  Building2,
  ContactRound,
  ListChecks,
  ChevronsUpDown,
  LogOut,
  Settings,
  User,
  Waves,
  Sparkles,
  ScrollText,
  Palette,
  ListTree,
  UsersRound,
  Inbox,
  type LucideIcon,
} from "lucide-react"
import { hasRecentRoadmapUpdates } from "@/lib/data/roadmap-status"
import { BUILD_VERSION } from "@/lib/version"
import { useHydratedNow } from "@/hooks/use-hydrated-now"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface NavigationItem {
  name: string
  href: string
  icon: LucideIcon
  badge?: string
  showNotification?: boolean
}

const repreneurNavigation: NavigationItem[] = [
  { name: "Dashboard", href: "/dashboard_re", icon: LayoutDashboard },
  { name: "Groups", href: "/repreneurs", icon: FolderKanban },
  { name: "Find", href: "/repreneurs/explore", icon: Search },
  { name: "Access requests", href: "/access-requests", icon: Inbox },
  { name: "Pipeline", href: "/pipeline", icon: GitBranch },
  { name: "Offers", href: "/offers", icon: Package },
  { name: "Analytics", href: "/analytics_re", icon: BarChart3 },
]

const opportunityNavigation: NavigationItem[] = [
  { name: "Dashboard", href: "/dashboard_op", icon: LayoutDashboard },
  { name: "Groups", href: "/opportunities/groups", icon: FolderKanban },
  { name: "Find", href: "/opportunities/find", icon: Search },
  { name: "Pursuits", href: "/opportunities/pursuits", icon: ListTree },
  { name: "Client portfolio", href: "/opportunities/pursuits/clients", icon: UsersRound },
  { name: "Analytics", href: "/analytics_op", icon: BarChart3 },
  { name: "External capacity", href: "/opportunities/pursuits/capacity", icon: Gauge },
]

const maNavigation: NavigationItem[] = [
  { name: "Activity", href: "/opportunities/ma/activity", icon: ListChecks },
  { name: "Firms", href: "/opportunities/ma/firms", icon: Building2 },
  { name: "Contacts", href: "/opportunities/ma/contacts", icon: ContactRound },
]

const toolsNavigation: NavigationItem[] = [
  { name: "Emails", href: "/emails", icon: Mail },
  { name: "WAVE AI", href: "/tools/wave-ai", icon: Sparkles },
]

const projectNavigation: NavigationItem[] = [
  {
    name: "Roadmap",
    href: "/guide/roadmap",
    icon: Map,
    showNotification: true,
  },
  { name: "Guidelines", href: "/guide/guidelines", icon: BookOpenCheck },
  { name: "Design system", href: "/guide/design-system", icon: Palette },
  { name: "Strategic PDR", href: "/strategic-pdr", icon: ScrollText },
]

// External users section removed - dead routes cleaned up

interface AppSidebarProps {
  userEmail?: string
  userName?: string
  userAvatar?: string
}

export function AppSidebar({
  userEmail = "user@renew.com",
  userName,
  userAvatar,
}: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const [pendingHref, setPendingHref] = React.useState<string | null>(null)
  const [hasMounted, setHasMounted] = React.useState(false)
  const now = useHydratedNow()
  const hasNewRoadmap = now !== null && hasRecentRoadmapUpdates(new Date(now))

  React.useEffect(() => {
    setPendingHref(null)
  }, [pathname])

  React.useEffect(() => {
    setHasMounted(true)
  }, [])

  // Check if current path is active
  const getIsActive = (href: string) => {
    if (href === "/dashboard_re")
      return pathname === "/dashboard_re" || pathname === "/dashboard"
    if (href === "/dashboard_op") return pathname === "/dashboard_op"
    if (href === "/analytics_re")
      return pathname === "/analytics_re" || pathname === "/analytics"
    if (href === "/analytics_op") return pathname === "/analytics_op"
    if (href === "/opportunities/groups")
      return pathname === "/opportunities/groups"
    if (href === "/opportunities/find")
      return pathname === "/opportunities/find"
    if (href === "/opportunities/pursuits")
      return pathname === "/opportunities/pursuits"
    if (href === "/repreneurs") return pathname === "/repreneurs"
    return pathname.startsWith(href)
  }

  const warmRoute = React.useCallback(
    (href: string) => {
      router.prefetch(href)
    },
    [router],
  )

  const startNavigation = (href: string) => {
    if (!getIsActive(href)) {
      setPendingHref(href)
    }
    warmRoute(href)
  }

  const linkWarmupProps = (href: string) => ({
    prefetch: true,
    onFocus: () => warmRoute(href),
    onPointerEnter: () => warmRoute(href),
    onPointerDown: () => warmRoute(href),
    onClick: () => {
      startNavigation(href)
      if (isMobile) setOpenMobile(false)
    },
  })

  // Get user initials for avatar fallback
  const userInitials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : userEmail.slice(0, 2).toUpperCase()

  // Display name
  const displayName = userName || userEmail.split("@")[0]

  return (
    <Sidebar collapsible="icon" className="overflow-hidden border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/80 p-2.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip="WAVE home"
              className="h-12 hover:bg-sidebar-accent/70 data-[state=open]:bg-sidebar-accent"
            >
              <Link href="/dashboard_re" {...linkWarmupProps("/dashboard_re")}>
                <span className="relative grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-[#7dd3c7]">
                  <Waves className="size-[18px]" strokeWidth={2} />
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-px left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-[#58a6ff]"
                  />
                </span>
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="text-[13px] font-semibold tracking-[0.12em] text-white">
                    WAVE
                  </span>
                  <span className="truncate text-[10px] text-sidebar-foreground/55">
                    Re-New operating system
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel>Repreneurs</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {repreneurNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      getIsActive(item.href) || pendingHref === item.href
                    }
                    tooltip={`Repreneurs · ${item.name}`}
                    className="h-9 data-[active=true]:shadow-[inset_2px_0_0_#58a6ff]"
                  >
                    <Link
                      href={item.href}
                      aria-current={getIsActive(item.href) ? "page" : undefined}
                      {...linkWarmupProps(item.href)}
                    >
                      <item.icon />
                      <span>{item.name}</span>
                      {item.badge && (
                        <span className="ml-auto text-[10px] font-medium opacity-50 bg-sidebar-accent px-1.5 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="opacity-60" />

        {/* Opportunities Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Opportunities</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {opportunityNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      getIsActive(item.href) || pendingHref === item.href
                    }
                    tooltip={`Opportunities · ${item.name}`}
                    className="h-9 data-[active=true]:shadow-[inset_2px_0_0_#58a6ff]"
                  >
                    <Link
                      href={item.href}
                      aria-current={getIsActive(item.href) ? "page" : undefined}
                      {...linkWarmupProps(item.href)}
                    >
                      <item.icon />
                      <span>{item.name}</span>
                      {item.badge && (
                        <span className="ml-auto text-[10px] font-medium opacity-50 bg-sidebar-accent px-1.5 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="opacity-60" />

        <SidebarGroup>
          <SidebarGroupLabel>M&amp;A</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {maNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      getIsActive(item.href) || pendingHref === item.href
                    }
                    tooltip={`M&A · ${item.name}`}
                    className="h-9 data-[active=true]:shadow-[inset_2px_0_0_#58a6ff]"
                  >
                    <Link
                      href={item.href}
                      aria-current={getIsActive(item.href) ? "page" : undefined}
                      {...linkWarmupProps(item.href)}
                    >
                      <item.icon />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="opacity-60" />

        {/* Tools Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      getIsActive(item.href) || pendingHref === item.href
                    }
                    tooltip={`Tools · ${item.name}`}
                    className="h-9 data-[active=true]:shadow-[inset_2px_0_0_#58a6ff]"
                  >
                    <Link
                      href={item.href}
                      aria-current={getIsActive(item.href) ? "page" : undefined}
                      {...linkWarmupProps(item.href)}
                    >
                      <item.icon />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="opacity-60" />

        {/* Project Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Project</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projectNavigation.map((item) => {
                const showRedDot = item.showNotification && hasNewRoadmap
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        getIsActive(item.href) || pendingHref === item.href
                      }
                      tooltip={`Project · ${item.name}`}
                      className="h-9 data-[active=true]:shadow-[inset_2px_0_0_#58a6ff]"
                    >
                      <Link
                        href={item.href}
                        aria-current={
                          getIsActive(item.href) ? "page" : undefined
                        }
                        {...linkWarmupProps(item.href)}
                      >
                        <span className="relative inline-flex">
                          <item.icon className="size-4" />
                          {showRedDot && (
                            <span
                              className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-400 ring-2 ring-sidebar"
                              aria-label="Recently updated"
                            />
                          )}
                        </span>
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/80 p-2.5">
        <div className="px-2 pb-0.5 group-data-[collapsible=icon]:hidden">
          <span className="font-mono text-[10px] text-sidebar-foreground/45">
            {BUILD_VERSION}
          </span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            {hasMounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-8 rounded-lg">
                      <AvatarImage src={userAvatar} alt={displayName} />
                      <AvatarFallback className="rounded-lg bg-[#1f6feb] text-xs text-white">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {displayName}
                      </span>
                      <span className="truncate text-xs opacity-60">
                        {userEmail}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 opacity-50" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="size-8 rounded-lg">
                        <AvatarImage src={userAvatar} alt={displayName} />
                        <AvatarFallback className="rounded-lg bg-[#1f6feb] text-xs text-white">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {displayName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {userEmail}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/account" {...linkWarmupProps("/account")}>
                        <User className="mr-2 size-4" />
                        Account
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings" {...linkWarmupProps("/settings")}>
                        <Settings className="mr-2 size-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a
                      href="/auth/logout"
                      className="text-red-600 focus:text-red-600"
                    >
                      <LogOut className="mr-2 size-4" />
                      Log out
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div aria-hidden="true">
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage src={userAvatar} alt={displayName} />
                    <AvatarFallback className="rounded-lg bg-[#1f6feb] text-xs text-white">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {displayName}
                    </span>
                    <span className="truncate text-xs opacity-60">
                      {userEmail}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 opacity-50" />
                </SidebarMenuButton>
              </div>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
