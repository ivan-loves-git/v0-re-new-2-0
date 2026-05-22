import { Suspense } from "react"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { getPostLoginDestination } from "@/lib/access-control"

async function RoutingGate() {
  await connection()
  redirect(await getPostLoginDestination())
}

export default function RoutingPage() {
  return (
    <Suspense fallback={null}>
      <RoutingGate />
    </Suspense>
  )
}
