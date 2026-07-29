import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("M&A networks and contact history", () => {
  it("keeps networks canonical, optional, and staff-only", () => {
    const migration = source("scripts/074_group_ma_sources_by_network.sql")

    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.ma_source_networks",
    )
    expect(migration).toContain("LOWER(BTRIM(name))")
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS network_id")
    expect(migration).toContain("ON DELETE SET NULL")
    expect(migration).toContain("REVOKE ALL ON TABLE public.ma_source_networks")
  })

  it("snapshots opportunity attribution before contacts can move", () => {
    const migration = source("scripts/075_preserve_ma_contact_move_history.sql")

    expect(migration).toContain("contact_email_snapshot")
    expect(migration).toContain("capture_opportunity_source_contact_snapshot")
    expect(migration).toContain(
      "DROP CONSTRAINT IF EXISTS opportunity_source_contacts_contact_source_fkey",
    )
    expect(migration).toContain("FOREIGN KEY (contact_id)")
  })

  it("records append-only old-to-new contact history with optimistic source locking", () => {
    const migration = source("scripts/075_preserve_ma_contact_move_history.sql")

    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.ma_source_contact_moves",
    )
    expect(migration).toContain("prevent_ma_source_contact_move_update")
    expect(migration).toContain("prevent_ma_source_contact_move_delete")
    expect(migration).toContain("p_expected_source_id")
    expect(migration).toContain("ma_source_contact_changed_since_loaded")
    expect(migration).toContain("FOR UPDATE")
  })

  it("retires legacy staff firm and contact routes in favor of canonical intake", () => {
    const sidebar = source("components/app-sidebar.tsx")
    const relationshipsRoute = source("app/(dashboard)/opportunities/ma/page.tsx")
    const firmsPage = source("app/(dashboard)/opportunities/ma/firms/page.tsx")
    const contactsPage = source(
      "app/(dashboard)/opportunities/ma/contacts/page.tsx",
    )

    expect(sidebar).not.toContain('href: "/opportunities/ma/firms"')
    expect(sidebar).not.toContain('href: "/opportunities/ma/contacts"')
    expect(relationshipsRoute).toContain("MaRelationshipWorkspace")
    for (const route of [firmsPage, contactsPage]) {
      expect(route).toContain('redirect("/opportunities/ma?view=')
    }
  })
})
