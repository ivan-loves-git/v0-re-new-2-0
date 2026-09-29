"use client"

import type { ComponentProps } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExternalPursuitBoard } from "@/components/pursuits/external-pursuit-board"
import { ReNewPursuitBoard } from "@/components/pursuits/renew-pursuit-board"
import type { ReNewStaffBoardRecord } from "@/lib/utils/renew-pursuit-board"
import type { ReNewPursuitBoardRecord } from "@/lib/actions/external-pursuit-board"

export function StaffPursuitsWorkspace({ renew, externalReNewContext, ...externalBoard }: {
  renew: ReNewStaffBoardRecord[]
  externalReNewContext: ReNewPursuitBoardRecord[]
} & Omit<ComponentProps<typeof ExternalPursuitBoard>, "renew" | "isStaff">) {
  return (
    <Tabs defaultValue="renew" className="min-w-0">
      <TabsList aria-label="Pursuit source">
        <TabsTrigger value="renew">Re-New</TabsTrigger>
        <TabsTrigger value="external">External pursuits</TabsTrigger>
      </TabsList>
      <TabsContent value="renew" forceMount className="data-[state=inactive]:hidden"><ReNewPursuitBoard records={renew} /></TabsContent>
      <TabsContent value="external" forceMount className="data-[state=inactive]:hidden"><ExternalPursuitBoard {...externalBoard} renew={externalReNewContext} isStaff /></TabsContent>
    </Tabs>
  )
}
