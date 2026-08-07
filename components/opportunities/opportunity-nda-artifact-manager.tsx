"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileCheck2, LockKeyhole, Upload } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DocumentRowActions } from "@/components/opportunities/document-row-actions"
import { registerOpportunityNdaArtifact } from "@/lib/actions/opportunity-nda-artifacts"
import { getOpportunityDocumentPolicy } from "@/lib/opportunity-document-policy"
import type { OpportunityNdaArtifact, OpportunityNdaArtifactRole } from "@/lib/types/opportunity"

interface OpportunityNdaArtifactManagerProps {
  opportunityId: string
  activeMatchId: string | null
  artifacts: OpportunityNdaArtifact[]
}

interface ArtifactRoleDefinition {
  role: OpportunityNdaArtifactRole
  title: string
  description: string
  defaultTitle: string
  acceptedFileLabel: string
  acceptedFileTypes: string
  uploadHelp: string
}

const ARTIFACT_ROLES: ArtifactRoleDefinition[] = [
  {
    role: "blank_template",
    title: "Blank NDA template",
    description: "Opportunity-level source document. This is not proof that either party has signed.",
    defaultTitle: "Blank NDA template",
    acceptedFileLabel: "PDF or DOCX file",
    acceptedFileTypes: "application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx",
    uploadHelp: "Upload one retained PDF or DOCX template. Files are limited to 4 MB.",
  },
  {
    role: "renew_signed_copy",
    title: "Re-New-signed copy",
    description: "Pursuit-level copy carrying Re-New’s signature. It does not prove the repreneur has signed.",
    defaultTitle: "NDA signed by Re-New",
    acceptedFileLabel: "PDF file",
    acceptedFileTypes: "application/pdf,.pdf",
    uploadHelp: "Upload one retained PDF file. Files are limited to 4 MB.",
  },
  {
    role: "repreneur_signed_copy",
    title: "Repreneur-signed copy",
    description:
      "Pursuit-level copy carrying the repreneur’s signature. Gate validation remains a separate staff action.",
    defaultTitle: "NDA signed by repreneur",
    acceptedFileLabel: "PDF file",
    acceptedFileTypes: "application/pdf,.pdf",
    uploadHelp: "Upload one retained PDF file. Files are limited to 4 MB.",
  },
]

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function currentArtifact(
  role: OpportunityNdaArtifactRole,
  artifacts: OpportunityNdaArtifact[],
  activeMatchId: string | null,
) {
  return (
    artifacts.find(
      (artifact) =>
        artifact.artifact_role === role &&
        (role === "blank_template" ? artifact.match_id == null : artifact.match_id === activeMatchId),
    ) ?? null
  )
}

export function OpportunityNdaArtifactManager({
  opportunityId,
  activeMatchId,
  artifacts,
}: OpportunityNdaArtifactManagerProps) {
  const router = useRouter()
  const [pendingRole, setPendingRole] = useState<OpportunityNdaArtifactRole | null>(null)
  const [message, setMessage] = useState<{
    role: OpportunityNdaArtifactRole
    tone: "success" | "error"
    text: string
  } | null>(null)

  async function handleRegister(role: OpportunityNdaArtifactRole, formData: FormData) {
    setPendingRole(role)
    setMessage(null)
    try {
      const result = await registerOpportunityNdaArtifact(formData)
      setMessage({
        role,
        tone: "success",
        text: result.versionNumber ? `Version ${result.versionNumber} recorded.` : "New version recorded.",
      })
      router.refresh()
    } catch (error) {
      setMessage({
        role,
        tone: "error",
        text: error instanceof Error ? error.message : "Could not record the artifact.",
      })
    } finally {
      setPendingRole(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <LockKeyhole />
        <AlertTitle>Staff-only retained evidence</AlertTitle>
        <AlertDescription>
          Every upload creates an immutable version. These records do not complete Gate 1 or Gate 2, disclose the
          source, or change repreneur access.
        </AlertDescription>
      </Alert>

      {ARTIFACT_ROLES.filter((definition) => definition.role !== "repreneur_signed_copy").map((definition) => {
        const roleArtifacts = artifacts.filter((artifact) => artifact.artifact_role === definition.role)
        const current = currentArtifact(definition.role, roleArtifacts, activeMatchId)
        const requiresPursuit = definition.role !== "blank_template"
        const isLockedSignedCopy = requiresPursuit && !activeMatchId
        const roleMessage = message?.role === definition.role ? message : null

        return (
          <section key={definition.role} className="flex flex-col gap-4 rounded-md border p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-medium">{definition.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{definition.description}</p>
              </div>
              {current ? (
                <Badge variant="secondary">Current v{current.version_number}</Badge>
              ) : (
                <Badge variant="outline">No current version</Badge>
              )}
            </div>

            {isLockedSignedCopy ? (
              <div className="rounded-md border bg-muted/40 px-3 py-3">
                <div className="flex items-start gap-2">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Available when an active pursuit starts</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Signed copies belong to a specific pursuit. Start an active pursuit to record a new version;
                      retained versions from earlier pursuits remain available below.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <form
                  action={handleRegister.bind(null, definition.role)}
                  className="grid gap-4 lg:grid-cols-[minmax(180px,0.8fr)_minmax(220px,1fr)_auto] lg:items-end"
                >
                  <input type="hidden" name="opportunity_id" value={opportunityId} />
                  <input type="hidden" name="artifact_role" value={definition.role} />
                  {requiresPursuit && activeMatchId && <input type="hidden" name="match_id" value={activeMatchId} />}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${definition.role}-title`}>Title</Label>
                    <Input
                      id={`${definition.role}-title`}
                      name="title"
                      defaultValue={definition.defaultTitle}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${definition.role}-file`}>{definition.acceptedFileLabel}</Label>
                    <Input
                      id={`${definition.role}-file`}
                      name="file"
                      type="file"
                      accept={definition.acceptedFileTypes}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={pendingRole === definition.role}>
                    <Upload data-icon="inline-start" />
                    {pendingRole === definition.role ? "Recording..." : "Record version"}
                  </Button>
                </form>

                <p className="text-xs text-muted-foreground">
                  {definition.uploadHelp}
                </p>
              </>
            )}

            {roleMessage && (
              <p
                role={roleMessage.tone === "error" ? "alert" : "status"}
                className={
                  roleMessage.tone === "error"
                    ? "text-sm text-destructive"
                    : "text-sm text-emerald-700 dark:text-emerald-400"
                }
              >
                {roleMessage.text}
              </p>
            )}

            {roleArtifacts.length > 0 && (
              <div className="flex flex-col gap-2 border-t pt-4">
                <p className="text-sm font-medium">Retained version history</p>
                {roleArtifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className="flex flex-col gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <FileCheck2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          v{artifact.version_number} · {artifact.document?.title ?? "NDA artifact"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(artifact.recorded_at)}
                          {artifact.match_id ? ` · pursuit ${artifact.match_id.slice(0, 8)}` : " · opportunity"}
                        </p>
                      </div>
                    </div>
                    <DocumentRowActions
                      policy={{
                        ...getOpportunityDocumentPolicy("nda", true),
                        canView: artifact.document?.mime_type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                      }}
                      state="locked"
                      viewHref={`/opportunities/${opportunityId}/nda-artifacts/${artifact.id}`}
                      downloadHref={`/opportunities/${opportunityId}/nda-artifacts/${artifact.id}?download`}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
