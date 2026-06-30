import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { Loader2 } from "lucide-react"
import { getPostLoginDestination } from "@/lib/access-control"
import { Button } from "@/components/ui/button"

async function RoutingGate() {
  await connection()
  redirect(await getPostLoginDestination())
  return null
}

export default function RoutingPage() {
  return (
    <Suspense fallback={<RoutingFallback />}>
      <RoutingGate />
    </Suspense>
  )
}

function RoutingFallback() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 text-center shadow-sm">
        <Loader2 className="mx-auto size-8 animate-spin text-blue-500" />
        <h1 className="mt-4 text-lg font-semibold text-foreground">
          Checking your access
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We are sending you to the right Re-New workspace.
        </p>
        <Button asChild variant="outline" className="mt-5 w-full">
          <Link href="/auth/logout" prefetch={false}>
            Switch account
          </Link>
        </Button>
      </div>
    </main>
  )
}
