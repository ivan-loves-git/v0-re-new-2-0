import Link from "next/link"
import { requireStaffAccess } from "@/lib/access-control"
import { submitStrategicPdrRequest } from "@/lib/actions/strategic-pdr"
import { listPdrRequestHistory } from "@/lib/pdr/intake-server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export default async function StrategicPdrRequestsPage() {
  await requireStaffAccess()
  const requests = await listPdrRequestHistory()
  return <div className="space-y-6">
    <div><p className="wave-micro-label">Strategic PDR</p><h1 className="text-2xl font-semibold">Request intake and history</h1><p className="text-sm text-muted-foreground">Requests and screening evidence live here. Current product work and discussion live in GitHub.</p></div>
    <Card><CardHeader><CardTitle>New request</CardTitle><CardDescription>Your identity is taken from your WAVE session. Attachments remain private to staff.</CardDescription></CardHeader><CardContent>
      <form action={submitStrategicPdrRequest} className="space-y-3"><Input required name="title" minLength={3} maxLength={140} placeholder="Short request title"/><Textarea required name="original_text" minLength={10} maxLength={4000} placeholder="Describe the problem or opportunity"/><Input name="attachments" type="file" multiple accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"/><Button type="submit">Submit for screening</Button></form>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Request history</CardTitle><CardDescription>Historical Work Cards are not delivery authority and are not editable here.</CardDescription></CardHeader><CardContent><ul className="divide-y">{requests.map((item) => <li key={item.id} className="py-3"><Link className="font-medium underline-offset-4 hover:underline" href={`/strategic-pdr/requests/${item.id}`}>{item.title}</Link><p className="text-sm text-muted-foreground">{item.disposition.kind ?? item.screening.status} · {new Date(item.createdAt).toLocaleDateString()}</p></li>)}</ul></CardContent></Card>
  </div>
}
