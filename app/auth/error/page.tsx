import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { UiText } from "@/components/i18n/ui-text"
import { LanguageToggle } from "@/components/intake-v2/language-toggle"

export default function AuthErrorPage() {
  return (
    <main id="main-content" className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md"><div className="mb-3 flex justify-end"><LanguageToggle /></div><Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 text-destructive" />
            <CardTitle className="text-2xl font-semibold tracking-[-0.025em]"><UiText text="Authentication error" /></CardTitle>
          </div>
          <CardDescription><UiText text="There was a problem signing you in" /></CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/auth/login"><UiText text="Back to Login" /></Link>
          </Button>
        </CardContent>
      </Card></div>
    </main>
  )
}
