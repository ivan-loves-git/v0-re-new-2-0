import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { connection } from "next/server"
import { validatePasswordResetLink } from "@/lib/password-reset-link"
import { ResetPasswordForm } from "./reset-password-form"

interface ResetPasswordPageProps {
  searchParams: Promise<{
    token?: string | string[]
    intent?: string | string[]
  }>
}

function singleSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null
}

async function ResetPasswordContent({
  searchParams,
}: ResetPasswordPageProps) {
  await connection()

  const params = await searchParams
  const token = singleSearchParam(params.token)
  const portalSetup = singleSearchParam(params.intent) === "portal"
  const isLinkValid = await validatePasswordResetLink(token)

  return (
    <ResetPasswordForm
      token={isLinkValid ? token : null}
      isLinkValid={isLinkValid}
      portalSetup={portalSetup}
    />
  )
}

function LoadingFallback() {
  return (
    <main
      id="main-content"
      className="flex min-h-svh items-center justify-center bg-background p-4"
    >
      <div className="w-full max-w-md">
        <div className="rounded-lg border bg-card p-8 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Validation du lien...</p>
        </div>
      </div>
    </main>
  )
}

export default function ResetPasswordPage(props: ResetPasswordPageProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordContent {...props} />
    </Suspense>
  )
}
