"use client"

import { Button } from "@/components/ui/button"

export default function EmailsError({ reset }: { error: Error; reset: () => void }) {
  return <div className="rounded-lg border bg-card p-6" role="alert">
    <h1 className="text-lg font-semibold">Email operations are unavailable</h1>
    <p className="mt-2 text-sm text-muted-foreground">The staff review queue could not be loaded. No draft was changed or sent.</p>
    <Button type="button" className="mt-4" variant="outline" onClick={reset}>Try again</Button>
  </div>
}
