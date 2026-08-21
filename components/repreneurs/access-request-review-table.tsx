"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { ArrowUpRight, UserPlus } from "lucide-react"

import { promoteWaitlistRepreneur, type WaitlistReviewRequest } from "@/lib/actions/waitlist-review"
import { formatDisplayDate } from "@/lib/utils/display-date-time"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function splitRequestName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return { firstName: parts[0] ?? "", lastName: "" }
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) ?? "" }
}

export function AccessRequestReviewTable({ requests }: { requests: WaitlistReviewRequest[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<WaitlistReviewRequest | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [message, setMessage] = useState("")
  const [createdHref, setCreatedHref] = useState("")
  const [pending, startTransition] = useTransition()

  function openPromotion(request: WaitlistReviewRequest) {
    const names = splitRequestName(request.name)
    setSelected(request)
    setFirstName(names.firstName)
    setLastName(names.lastName)
    setMessage("")
    setCreatedHref("")
  }

  function promote() {
    if (!selected) return
    setMessage("")
    startTransition(async () => {
      const result = await promoteWaitlistRepreneur(selected.id, firstName, lastName)
      if (!result.ok) {
        setMessage(result.message)
        return
      }
      setCreatedHref(result.href)
      setMessage("Access request approved and linked to the Repreneur profile.")
      router.refresh()
    })
  }

  if (!requests.length) {
    return <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No access requests match this search.</div>
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requester</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Received</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <div className="font-medium">{request.name}</div>
                  <div className="text-xs text-muted-foreground">{request.email}</div>
                </TableCell>
                <TableCell><Badge variant="outline">{request.role === "repreneur" ? "Repreneur" : "Seller"}</Badge></TableCell>
                <TableCell><Badge variant={request.promotedRepreneurId ? "secondary" : "outline"}>{request.promotedRepreneurId ? "Promoted" : request.status}</Badge></TableCell>
                <TableCell>{formatDisplayDate(request.createdAt, "en-GB")}</TableCell>
                <TableCell className="text-right">
                  {request.promotedRepreneurId ? (
                    <Button asChild size="sm" variant="outline"><Link href={`/repreneurs/${request.promotedRepreneurId}`}>Open profile <ArrowUpRight /></Link></Button>
                  ) : request.role === "repreneur" ? (
                    <Button size="sm" onClick={() => openPromotion(request)}><UserPlus />Review</Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Seller review only</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Repreneur request</DialogTitle>
            <DialogDescription>Confirm the names in case a new profile is needed. If the email already belongs to a Repreneur, this request links to that profile instead.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="access-first-name">First name</Label><Input id="access-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="access-last-name">Last name</Label><Input id="access-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></div>
          </div>
          {message ? <p role={createdHref ? "status" : "alert"} className="text-sm text-muted-foreground">{message}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            {createdHref ? <Button asChild><Link href={createdHref}>Open profile <ArrowUpRight /></Link></Button> : <Button onClick={promote} disabled={pending}>{pending ? "Approving…" : "Create or link profile"}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
