import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { PlugZap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUserAccess } from "@/lib/access-control"
import {
  MISSING_DISPLAY_NAME,
  cancelledAuthorizeLocation,
  connectionCopy,
  lacksDisplayName,
  nextAuthorizeStep,
} from "@/lib/mcp/authorize-flow"
import {
  MCP_AUTHORIZE_PATH,
  mcpRedirectDestination,
  pickMcpAuthorizeParams,
} from "@/lib/mcp/oauth-policy"
import { findMcpClient } from "@/lib/mcp/runtime"

export const metadata: Metadata = {
  title: "Connect Claude to WAVE",
  robots: { index: false, follow: false },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function firstValues(raw: Record<string, string | string[] | undefined>) {
  const values = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value
    if (typeof first === "string") values.set(key, first)
  }
  return values
}

function Shell({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <main id="main-content" className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <PlugZap className="size-5 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-2xl font-semibold tracking-[-0.025em]">{title}</CardTitle>
            </div>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          {children ? <CardContent className="space-y-4">{children}</CardContent> : null}
        </Card>
      </div>
    </main>
  )
}

/** Staff confirm here before Claude receives read access (#265). */
export default async function ConnectClaudePage({ searchParams }: { searchParams: SearchParams }) {
  const params = pickMcpAuthorizeParams(firstValues(await searchParams))
  const access = await getCurrentUserAccess()
  const step = nextAuthorizeStep(params, access?.role ?? null)
  if (step.kind === "login") redirect(step.location)

  const invalid = (
    <Shell
      title="Connection request not valid"
      description="In Claude, remove the WAVE connection and add it again."
    />
  )
  if (step.kind === "invalid") return invalid
  if (step.kind === "forbidden") {
    return (
      <Shell
        title="Staff accounts only"
        description="This WAVE account is not a staff account, so it cannot connect Claude to WAVE."
      />
    )
  }

  if (lacksDisplayName(access!.user)) {
    return <Shell title="One detail missing" description={MISSING_DISPLAY_NAME} />
  }

  const redirectUri = params.get("redirect_uri")!
  const destination = mcpRedirectDestination(redirectUri)
  const client = await findMcpClient(params.get("client_id")!)
  if (!destination || !client || !client.redirectUris.includes(redirectUri)) return invalid

  const copy = connectionCopy(destination, access!.user.email)
  return (
    <Shell title={copy.title} description={copy.description}>
      <p className="text-sm font-medium">{copy.caution}</p>
      {copy.warning ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {copy.warning}
        </p>
      ) : null}
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>It can read every record your staff account can see in WAVE.</li>
        <li>It cannot create, change or delete anything.</li>
        <li>What it reads is confidential Re-New client information.</li>
      </ul>
      <form method="post" action={MCP_AUTHORIZE_PATH} className="space-y-2">
        {[...params.entries()].map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <Button type="submit" className="w-full">
          Allow read access
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <a href={cancelledAuthorizeLocation(params)}>Cancel</a>
        </Button>
      </form>
    </Shell>
  )
}
