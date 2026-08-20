"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Upload } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  registerOpportunityDocument,
  removeOpportunityDocument,
  updateOpportunityDocumentVisibility,
} from "@/lib/actions/opportunity-documents"
import { DocumentRowActions, type DocumentInteractionState } from "@/components/opportunities/document-row-actions"
import { getOpportunityDocumentPolicy } from "@/lib/opportunity-document-policy"
import { formatDisplayDate } from "@/lib/utils/display-date-time"
import {
  FieldError,
  type FieldErrors,
  fieldErrorProps,
  focusValidationSummary,
  FormFieldLabel,
  ValidationSummary,
} from "@/components/forms/validation-feedback"
import {
  OPPORTUNITY_DOCUMENT_TYPE_OPTIONS,
  OPPORTUNITY_DOCUMENT_VISIBILITY_OPTIONS,
  type OpportunityDocument,
  type OpportunityDocumentType,
  type OpportunityDocumentVisibility,
} from "@/lib/types/opportunity"

interface OpportunityDocumentsPanelProps {
  opportunityId: string
  documents: OpportunityDocument[]
  canonicalNdaDocumentIds?: string[]
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "-"
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string) {
  return formatDisplayDate(value, "fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function documentTypeLabel(type: OpportunityDocumentType) {
  return OPPORTUNITY_DOCUMENT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type.replaceAll("_", " ")
}

export function OpportunityDocumentsPanel({
  opportunityId,
  documents,
  canonicalNdaDocumentIds = [],
}: OpportunityDocumentsPanelProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const validationSummaryRef = useRef<HTMLDivElement>(null)
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null)
  const [documentType, setDocumentType] = useState<OpportunityDocumentType>("teaser")
  const canonicalNdaDocumentIdSet = new Set(canonicalNdaDocumentIds)
  const selectedTypeIsStaffOnly = documentType === "source_teaser" || documentType === "deal_book"

  function validate(formData: FormData): FieldErrors {
    const errors: FieldErrors = {}
    if (!String(formData.get("title") ?? "").trim()) errors["document-title"] = "Enter a document title."
    const file = formData.get("file")
    if (!(file instanceof File) || file.size <= 0) errors["document-file"] = "Select a file to upload."
    return errors
  }

  async function handleSubmit(formData: FormData) {
    const errors = validate(formData)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      focusValidationSummary(validationSummaryRef)
      return
    }

    setIsSubmitting(true)
    setFieldErrors({})
    try {
      const result = await registerOpportunityDocument(formData)
      if (!result.success) {
        setFieldErrors({ form: result.message })
        focusValidationSummary(validationSummaryRef)
        toast.error("Document not added", { description: result.message })
        return
      }
      toast.success("Document added", { description: result.message })
      router.refresh()
    } catch {
      setFieldErrors({ form: "Please try again." })
      focusValidationSummary(validationSummaryRef)
      toast.error("Document not added", { description: "Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVisibility(documentId: string, visibility: OpportunityDocumentVisibility) {
    setPendingDocumentId(documentId)
    try {
      const result = await updateOpportunityDocumentVisibility(documentId, opportunityId, visibility)
      if (!result.success) {
        toast.error("Document visibility not changed", { description: result.message })
        return
      }
      toast.success("Document visibility changed", { description: result.message })
      router.refresh()
    } catch {
      toast.error("Document visibility not changed", { description: "Please try again." })
    } finally {
      setPendingDocumentId(null)
    }
  }

  async function handleRemove(documentId: string) {
    setPendingDocumentId(documentId)
    try {
      const result = await removeOpportunityDocument(documentId, opportunityId)
      if (!result.success) {
        toast.error("Document not removed", { description: result.message })
        return
      }
      toast.success("Document removed", { description: result.message })
      router.refresh()
    } catch {
      toast.error("Document not removed", { description: "Please try again." })
    } finally {
      setPendingDocumentId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-5" />
            Add document
          </CardTitle>
          <CardDescription>Source teasers and Information Memoranda stay staff-only; access is granted only from the pursuit workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate action={handleSubmit} className="grid gap-4 lg:grid-cols-[1fr_180px_220px_1fr_auto] lg:items-end">
            <input type="hidden" name="opportunity_id" value={opportunityId} />
            <div className="lg:col-span-5">
              <ValidationSummary
                ref={validationSummaryRef}
                errors={fieldErrors}
                labels={{ "document-title": "Title", "document-file": "File", form: "Document details" }}
              />
            </div>
            <div className="space-y-2">
              <FormFieldLabel htmlFor="document-title" requirement="required">Title</FormFieldLabel>
              <Input
                id="document-title"
                name="title"
                placeholder="Teaser, IM, analysis..."
                required
                {...fieldErrorProps("document-title", fieldErrors["document-title"])}
                onChange={() => setFieldErrors((current) => ({ ...current, "document-title": "", form: "" }))}
              />
              <FieldError id="document-title" message={fieldErrors["document-title"]} />
            </div>
            <div className="space-y-2">
              <FormFieldLabel htmlFor="document-type" requirement="required">Type</FormFieldLabel>
              <Select name="document_type" value={documentType} onValueChange={(value) => setDocumentType(value as OpportunityDocumentType)}>
                <SelectTrigger id="document-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {OPPORTUNITY_DOCUMENT_TYPE_OPTIONS.filter((option) => option.value !== "nda").map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <FormFieldLabel htmlFor="document-visibility" requirement="optional">Visibility</FormFieldLabel>
              {selectedTypeIsStaffOnly ? (
                <>
                  <input type="hidden" name="visibility" value="staff_only" />
                  <div id="document-visibility" className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">Staff only</div>
                </>
              ) : (
                <Select name="visibility" defaultValue="staff_only">
                  <SelectTrigger id="document-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {OPPORTUNITY_DOCUMENT_VISIBILITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <FormFieldLabel htmlFor="document-file" requirement="required">File</FormFieldLabel>
              <Input
                id="document-file"
                name="file"
                type="file"
                accept={selectedTypeIsStaffOnly ? "application/pdf,.pdf" : undefined}
                required
                {...fieldErrorProps("document-file", fieldErrors["document-file"])}
                onChange={() => setFieldErrors((current) => ({ ...current, "document-file": "", form: "" }))}
              />
              <FieldError id="document-file" message={fieldErrors["document-file"]} />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Documents
          </CardTitle>
          <CardDescription>Metadata and visibility control for attached deal files.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No documents attached.
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((document) => {
                    const isCanonicalNdaArtifact = canonicalNdaDocumentIdSet.has(document.id)
                    const policy = getOpportunityDocumentPolicy(document.document_type, isCanonicalNdaArtifact)
                    const state: DocumentInteractionState = pendingDocumentId === document.id
                      ? "pending"
                      : policy.retained
                        ? "locked"
                        : "available"
                    return (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div className="font-medium">{document.title}</div>
                      </TableCell>
                      <TableCell>{documentTypeLabel(document.document_type)}</TableCell>
                      <TableCell>
                        <Badge variant={document.visibility === "staff_only" ? "secondary" : "default"}>
                          {document.visibility === "staff_only" ? "Staff only" : "Approved"}
                        </Badge>
                        {isCanonicalNdaArtifact && (
                          <Badge variant="outline" className="ml-2">
                            Retained NDA evidence
                          </Badge>
                        )}
                        {document.visibility === "approved_for_repreneur" && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {document.repreneur_approved_at && document.repreneur_approved_by
                              ? `Approval recorded ${formatDate(document.repreneur_approved_at)}`
                              : "Approval evidence required before portal access"}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{formatBytes(document.size_bytes)}</TableCell>
                      <TableCell>{formatDate(document.uploaded_at)}</TableCell>
                      <TableCell>
                        <DocumentRowActions
                          policy={policy}
                          state={state}
                          viewHref={`/opportunities/${encodeURIComponent(opportunityId)}/documents/${encodeURIComponent(document.id)}`}
                          downloadHref={`/opportunities/${encodeURIComponent(opportunityId)}/documents/${encodeURIComponent(document.id)}?download`}
                          onMarkStaffOnly={() => handleVisibility(document.id, "staff_only")}
                          onMarkApproved={() => handleVisibility(document.id, "approved_for_repreneur")}
                          onRemove={() => handleRemove(document.id)}
                        />
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
