"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, AlertCircle, CheckCircle, Star, Users } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { previewFlatchrImport, importFlatchrData, type ImportResult } from "@/lib/actions/flatchr-import"

interface PreviewData {
  total: number
  unique: number
  duplicatesRemoved: number
  sampleRecords: Array<{
    first_name: string
    last_name: string
    tier1_score: number
    tier2_stars: number
    lifecycle_status: string
  }>
  starDistribution: Record<number, number>
}

export default function FlatchrImportPage() {
  const router = useRouter()
  const [tsvContent, setTsvContent] = useState("")
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePreview = async () => {
    if (!tsvContent.trim()) {
      setError("Please paste the Flatchr export data")
      return
    }

    setIsLoading(true)
    setError(null)
    setPreview(null)

    try {
      const data = await previewFlatchrImport(tsvContent)
      setPreview(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse data")
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    if (!preview) return

    setIsImporting(true)
    setError(null)

    try {
      const importResult = await importFlatchrData(tsvContent)
      setResult(importResult)

      if (importResult.success && importResult.imported > 0) {
        // Redirect to repreneurs list after successful import
        setTimeout(() => {
          router.push("/repreneurs")
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import data")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <BackButton label="Back to Repreneurs" href="/repreneurs" />
      </div>

      <div>
        <h1 className="text-2xl font-bold">Import from Flatchr</h1>
        <p className="text-gray-500 mt-1">
          Import repreneur profiles from Flatchr ATS export
        </p>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>1. Export your candidates from Flatchr as TSV (Tab-Separated Values)</p>
          <p>2. Copy the entire content and paste it below</p>
          <p>3. Click "Preview Import" to see what will be imported</p>
          <p>4. Review the preview and click "Import" to confirm</p>

          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Note</AlertTitle>
            <AlertDescription>
              Flatchr export does not include email addresses. Imported records will show a
              "Missing: Email" badge until you add the email manually.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Data Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Paste Flatchr Export
          </CardTitle>
          <CardDescription>
            Paste the TSV content from your Flatchr export
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste your Flatchr TSV export here..."
            value={tsvContent}
            onChange={(e) => {
              setTsvContent(e.target.value)
              setPreview(null)
              setResult(null)
              setError(null)
            }}
            rows={10}
            className="font-mono text-sm"
          />

          <Button onClick={handlePreview} disabled={isLoading || !tsvContent.trim()}>
            {isLoading ? "Parsing..." : "Preview Import"}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && !result && (
        <Card>
          <CardHeader>
            <CardTitle>Import Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-900">{preview.total}</div>
                <div className="text-sm text-gray-500">Total rows</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-700">{preview.unique}</div>
                <div className="text-sm text-gray-500">Unique records</div>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <div className="text-3xl font-bold text-amber-700">{preview.duplicatesRemoved}</div>
                <div className="text-sm text-gray-500">Duplicates removed</div>
              </div>
            </div>

            {/* Star Distribution */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Star className="h-4 w-4" />
                Star Distribution (Status Assignment)
              </h4>
              <div className="flex gap-2 flex-wrap">
                {[0, 1, 2, 3, 4, 5].map((stars) => (
                  <div
                    key={stars}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex">
                      {stars === 0 ? (
                        <span className="text-gray-400 text-sm">No stars</span>
                      ) : (
                        Array.from({ length: stars }).map((_, i) => (
                          <Star
                            key={i}
                            className="h-4 w-4 fill-yellow-400 text-yellow-400"
                          />
                        ))
                      )}
                    </div>
                    <Badge variant={stars > 0 ? "default" : "secondary"}>
                      {preview.starDistribution[stars] || 0}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {stars > 0 ? "Qualified" : "Lead"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample Records */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Sample Records (first 5)
              </h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Score</th>
                      <th className="px-4 py-2 text-left">Stars</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleRecords.map((record, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-4 py-2 font-medium">
                          {record.first_name} {record.last_name}
                        </td>
                        <td className="px-4 py-2">{record.tier1_score}</td>
                        <td className="px-4 py-2">
                          <div className="flex">
                            {record.tier2_stars > 0 ? (
                              Array.from({ length: record.tier2_stars }).map((_, i) => (
                                <Star
                                  key={i}
                                  className="h-3 w-3 fill-yellow-400 text-yellow-400"
                                />
                              ))
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <Badge
                            variant={
                              record.lifecycle_status === "qualified"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {record.lifecycle_status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Import Button */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null)
                  setTsvContent("")
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? "Importing..." : `Import ${preview.unique} Records`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card>
          <CardContent className="pt-6">
            {result.success ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Import Successful</AlertTitle>
                <AlertDescription className="text-green-700">
                  Imported {result.imported} records.
                  {result.skipped > 0 && ` Skipped ${result.skipped} duplicates.`}
                  <br />
                  Redirecting to repreneurs list...
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Import Completed with Errors</AlertTitle>
                <AlertDescription>
                  Imported {result.imported} records.
                  {result.errors.length > 0 && (
                    <ul className="mt-2 list-disc pl-4">
                      {result.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
