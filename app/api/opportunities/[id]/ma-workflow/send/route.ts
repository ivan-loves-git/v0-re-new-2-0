import { NextResponse } from "next/server"
import { sendMaSourceWorkflowEmailPayload } from "@/lib/actions/ma-workflows"
import { isUuid } from "@/lib/uuid"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) {
    return NextResponse.json({ success: false, error: "Opportunity not found." }, { status: 404 })
  }
  const body = await request.json().catch(() => null)

  const result = await sendMaSourceWorkflowEmailPayload(id, {
    templateKey: typeof body?.templateKey === "string" ? body.templateKey.trim() : null,
    subject: typeof body?.subject === "string" ? body.subject.trim() : null,
    body: typeof body?.body === "string" ? body.body.trim() : null,
    contactId: typeof body?.contactId === "string" ? body.contactId.trim() : null,
    clientOperationKey: typeof body?.clientOperationKey === "string" ? body.clientOperationKey.trim() : null,
  })

  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
