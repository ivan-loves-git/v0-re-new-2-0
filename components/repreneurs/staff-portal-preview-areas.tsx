"use client"

import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUiCopy } from "@/components/i18n/ui-text"

export function StaffPortalPreviewAreas() {
  const copy = useUiCopy()
  return <TabsList aria-label={copy("Selected repreneur portal areas")}>
    <TabsTrigger value="deals">{copy("Deals")}</TabsTrigger>
    <TabsTrigger value="profile">{copy("Profile")}</TabsTrigger>
    <TabsTrigger value="renew-pursuits">{copy("Re-New Pursuits")}</TabsTrigger>
    <TabsTrigger value="external-pursuits">{copy("External Pursuits")}</TabsTrigger>
  </TabsList>
}
