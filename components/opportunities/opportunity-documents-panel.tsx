"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, FileText, MoreHorizontal, Trash2, Upload } from "lucide-react"
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
  type OpportunityDocumentVisibility,
} from "@/lib/types/opportunity"

interface OpportunityDocumentsPanelProps {
  opportunityId: string
  documents: OpportunityDocument[]
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "-"
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

export function OpportunityDocumentsPanel({ opportunityId, documents }: OpportunityDocumentsPanelProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true)
    try {
      await registerOpportunityDocument(formData)
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVisibility(documentId: string, visibility: OpportunityDocumentVisibility) {
    await updateOpportunityDocumentVisibility(documentId, opportunityId, visibility)
    router.refresh()
  }

  async function handleRemove(documentId: string) {
    await removeOpportunityDocument(documentId, opportunityId)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-5" />
            Add document
          </CardTitle>
          <CardDescription>Documents stay staff-only unless visibility is changed explicitly.</CardDescription>
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
              <Select name="document_type" defaultValue="teaser">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-file">File</Label>
              <Input id="document-file" name="file" type="file" />
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
                  documents.map((document) => (
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
                      <TableCell>{document.document_type.replaceAll("_", " ")}</TableCell>
                      <TableCell>
                        <Badge variant={document.visibility === "staff_only" ? "secondary" : "default"}>
                          {document.visibility === "staff_only" ? "Staff only" : "Approved"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatBytes(document.size_bytes)}</TableCell>
                      <TableCell>{formatDate(document.uploaded_at)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
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
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
