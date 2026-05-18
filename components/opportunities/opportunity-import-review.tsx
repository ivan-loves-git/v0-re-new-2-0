"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, FileUp, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  commitOpportunityImport,
  previewOpportunityImport,
  type OpportunityImportCommitSummary,
  type OpportunityImportPreview,
} from "@/lib/actions/opportunity-import"
import {
  parseDelimitedOpportunityRows,
  type OpportunityImportRawRow,
} from "@/lib/utils/opportunity-import"
import { OpportunityImportSummary } from "@/components/opportunities/opportunity-import-summary"

function parseRowsFromText(text: string): OpportunityImportRawRow[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : []
  }

  return parseDelimitedOpportunityRows(trimmed)
}

export function OpportunityImportReview() {
  const router = useRouter()
  const [rawText, setRawText] = useState("")
  const [rows, setRows] = useState<OpportunityImportRawRow[]>([])
  const [preview, setPreview] = useState<OpportunityImportPreview | null>(null)
  const [commitSummary, setCommitSummary] = useState<OpportunityImportCommitSummary | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [isBusy, setIsBusy] = useState(false)

  const selectedValidCount = useMemo(() => {
    if (!preview) return 0
    return preview.results.filter((result) => selectedRows.has(result.rowIndex) && result.isValid).length
  }, [preview, selectedRows])

  async function runPreview(nextRows = rows) {
    setIsBusy(true)
    try {
      const sourceRows = nextRows.length > 0 ? nextRows : parseRowsFromText(rawText)
      setRows(sourceRows)
      const formData = new FormData()
      formData.append("rows_json", JSON.stringify(sourceRows))
      const result = await previewOpportunityImport(formData)
      setPreview(result)
      setCommitSummary(null)
      setSelectedRows(new Set(result.results.filter((row) => row.isValid).map((row) => row.rowIndex)))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleFile(file: File) {
    const text = await file.text()
    setRawText(text)
    const parsedRows = parseRowsFromText(text)
    setRows(parsedRows)
    await runPreview(parsedRows)
  }

  async function handleCommit() {
    if (!preview) return

    setIsBusy(true)
    try {
      const formData = new FormData()
      formData.append("rows_json", JSON.stringify(rows))
      formData.append("approved_indexes", JSON.stringify(Array.from(selectedRows)))
      const result = await commitOpportunityImport(formData)
      setCommitSummary(result)
      router.refresh()
    } finally {
      setIsBusy(false)
    }
  }

  function toggleRow(index: number, checked: boolean) {
    setSelectedRows((current) => {
      const next = new Set(current)
      if (checked) next.add(index)
      else next.delete(index)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/opportunities/find">
          <ArrowLeft className="size-4" />
          Back to Opportunities
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Import opportunities</h1>
        <p className="text-sm text-muted-foreground">Review mapped rows and diagnostics before saving.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="size-5" />
            Source rows
          </CardTitle>
          <CardDescription>Use CSV, TSV, or JSON rows exported from the workbook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".csv,.tsv,.txt,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          <Textarea
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            rows={6}
            placeholder="Paste CSV/TSV/JSON rows here..."
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void runPreview()} disabled={isBusy}>
              Preview rows
            </Button>
            <Button type="button" variant="outline" onClick={handleCommit} disabled={!preview || selectedValidCount === 0 || isBusy}>
              <Save className="size-4" />
              Save {selectedValidCount}
            </Button>
          </div>
        </CardContent>
      </Card>

      <OpportunityImportSummary preview={preview} commitSummary={commitSummary} />

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
            <CardDescription>Blocked rows cannot be saved until required fields are fixed.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Diagnostics</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.results.map((result) => (
                    <TableRow key={result.rowIndex}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRows.has(result.rowIndex)}
                          disabled={!result.isValid}
                          onCheckedChange={(checked) => toggleRow(result.rowIndex, checked === true)}
                          aria-label={`Select row ${result.rowIndex + 1}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{result.draft.reference}</TableCell>
                      <TableCell>{result.draft.sector ?? "-"}</TableCell>
                      <TableCell>{result.draft.location ?? "-"}</TableCell>
                      <TableCell>{result.draft.revenue_meur ?? "-"}</TableCell>
                      <TableCell>
                        {result.diagnostics.length === 0 ? (
                          <Badge variant="secondary">Ready</Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {result.diagnostics.map((diagnostic) => (
                              <Badge
                                key={`${result.rowIndex}-${diagnostic.field}-${diagnostic.message}`}
                                variant={diagnostic.severity === "blocker" ? "destructive" : "outline"}
                              >
                                {diagnostic.message}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
