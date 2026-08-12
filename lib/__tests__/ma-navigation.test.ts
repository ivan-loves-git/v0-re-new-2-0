import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("W-084 M&A navigation", () => {
  const sidebar = source("components/app-sidebar.tsx")
  const legacyRoute = source("app/(dashboard)/opportunities/ma/page.tsx")
  const activityRoute = source(
    "app/(dashboard)/opportunities/ma/activity/page.tsx",
  )
  const firmsRoute = source("app/(dashboard)/opportunities/ma/firms/page.tsx")
  const contactsRoute = source(
    "app/(dashboard)/opportunities/ma/contacts/page.tsx",
  )
  const workspace = source(
    "components/opportunities/ma-relationship-workspace.tsx",
  )
  const floatingNav = source("components/floating-nav.tsx")

  it("gives staff a dedicated M&A section with direct destinations", () => {
    expect(sidebar).toContain("const maNavigation")
    expect(sidebar).toContain("M&amp;A")
    expect(sidebar).toContain('href: "/opportunities/ma/activity"')
    expect(sidebar).toContain('href: "/opportunities/ma/firms"')
    expect(sidebar).toContain('href: "/opportunities/ma/contacts"')
    expect(sidebar).not.toContain('href: "/opportunities/ma", icon: UsersRound')
    expect(sidebar).toContain("if (isMobile) setOpenMobile(false)")
    expect(sidebar).toContain("{...linkWarmupProps(item.href)}")
    expect(floatingNav).toContain('ma: "M&A"')
    expect(floatingNav).toContain('activity: "Activity"')
    expect(floatingNav).toContain('"Firm detail"')
    expect(floatingNav).toContain('"Office detail"')
    expect(floatingNav).toContain('href: "/opportunities/ma/firms"')
  })

  it("renders each direct route with the same staff-gated canonical workspace", () => {
    expect(activityRoute).toContain("getMaRelationshipWorkspace")
    expect(activityRoute).toContain('initialView="timeline"')
    expect(firmsRoute).toContain("getMaRelationshipWorkspace")
    expect(firmsRoute).toContain('initialView="firms"')
    expect(contactsRoute).toContain("getMaRelationshipWorkspace")
    expect(contactsRoute).toContain('initialView="contacts"')
    expect(contactsRoute).toContain("initialContactId")
    expect(contactsRoute).toContain("workspace.contacts.some")
  })

  it("keeps cross-section navigation in the dedicated sidebar, not inside a page", () => {
    expect(workspace).not.toContain("M&A views")
    expect(workspace).not.toContain("TabsTrigger")
    expect(workspace).not.toContain("Internal relationship history")
    expect(workspace).not.toContain("router.replace(")
    expect(workspace).toContain('initialView === "timeline"')
    expect(workspace).toContain('initialView === "firms"')
  })

  it("redirects former relationship URLs to the dedicated pages", () => {
    expect(legacyRoute).toContain("redirect(")
    expect(legacyRoute).toContain('view === "firms" || view === "contacts"')
    expect(legacyRoute).toContain("`/opportunities/ma/${destination}`")
  })

  it("does not alter the canonical M&A interaction ledger or repreneur navigation", () => {
    expect(workspace).toContain("createMaRelationshipInteraction(input)")
    expect(sidebar).not.toContain('href: "/portal/')
  })

  it("keeps a valid contact deep link inside the canonical directory", () => {
    expect(workspace).toContain("initialContactId")
    expect(workspace).toContain("contacts.find((contact) => contact.id === initialContactId)")
  })
})
