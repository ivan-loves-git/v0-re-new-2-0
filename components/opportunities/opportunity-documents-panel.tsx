"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Download, ExternalLink, FileText, MoreHorizontal, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  registerOpportunityDocument,
  removeOpportunityDocument,
  updateOpportunityDocumentVisibility,
} from "@/lib/actions/opportunity-documents"
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
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

function documentTypeLabel(type: OpportunityDocumentType) {
  return OPPORTUNITY_DOCUMENT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type.replaceAll("_", " ")
}

function hasRetainedPolicy(document: OpportunityDocument) {
  return document.document_type === "source_teaser" || document.document_type === "deal_book"
}

export function OpportunityDocumentsPanel({
  opportunityId,
  documents,
  canonicalNdaDocumentIds = [],
}: OpportunityDocumentsPanelProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [documentType, setDocumentType] = useState<OpportunityDocumentType>("teaser")
  const canonicalNdaDocumentIdSet = new Set(canonicalNdaDocumentIds)
  const selectedTypeIsStaffOnly = documentType === "source_teaser" || documentType === "deal_book"

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true)
    try {
      const result = await registerOpportunityDocument(formData)
      if (!result.success) {
        toast.error("Document not added", { description: result.message })
        return
      }
      toast.success("Document added", { description: result.message })
      router.refresh()
    } catch {
      toast.error("Document not added", { description: "Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVisibility(documentId: string, visibility: OpportunityDocumentVisibility) {
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
    }
  }

  async function handleRemove(documentId: string) {
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
          <form action={handleSubmit} className="grid gap-4 lg:grid-cols-[1fr_180px_220px_1fr_auto] lg:items-end">
            <input type="hidden" name="opportunity_id" value={opportunityId} />
            <div className="space-y-2">
              <Label htmlFor="document-title">Title</Label>
              <Input id="document-title" name="title" placeholder="Teaser, NDA, analysis..." required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-type">Type</Label>
              <Select name="document_type" value={documentType} onValueChange={(value) => setDocumentType(value as OpportunityDocumentType)}>
                <SelectTrigger id="document-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {OPPORTUNITY_DOCUMENT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-visibility">Visibility</Label>
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
              <Label htmlFor="document-file">File</Label>
              <Input id="document-file" name="file" type="file" accept={selectedTypeIsStaffOnly ? "application/pdf,.pdf" : undefined} />
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
                    const isRetained = hasRetainedPolicy(document)
                    return (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div className="font-medium">{document.title}</div>
                        {document.external_url && (
                          <Button asChild variant="link" className="h-auto p-0 text-xs">
                            <Link href={document.external_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-3" />
                              External link
                            </Link>
                          </Button>
                        )}
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
                        {isCanonicalNdaArtifact || isRetained ? (
                          <span className="text-xs text-muted-foreground">Locked</span>
                        ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <a href={`/opportunities/${encodeURIComponent(opportunityId)}/documents/${encodeURIComponent(document.id)}`} target="_blank" rel="noreferrer">
                                <Download className="size-4" />
                                View or download
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleVisibility(document.id, "staff_only")}>
                              Mark staff-only
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleVisibility(document.id, "approved_for_repreneur")}>
                              Mark approved
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRemove(document.id)}>
                              <Trash2 className="size-4" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        )}
                        {(isCanonicalNdaArtifact || isRetained) && (
                          <Button asChild variant="ghost" size="sm" className="h-8">
                            <a href={`/opportunities/${encodeURIComponent(opportunityId)}/documents/${encodeURIComponent(document.id)}`} target="_blank" rel="noreferrer">
                              <Download className="size-4" />
                              View
                            </a>
                          </Button>
                        )}
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
