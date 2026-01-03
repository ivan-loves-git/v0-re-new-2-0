"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import type { Repreneur } from "@/lib/types/repreneur"
import { SOURCE_OPTIONS } from "@/lib/types/repreneur"
import { INVESTMENT_CAPACITY_OPTIONS, INDUSTRY_SECTOR_OPTIONS, TARGET_ACQUISITION_SIZE_OPTIONS, TARGET_LOCATION_OPTIONS } from "@/lib/utils/tier1-scoring"

interface RepreneurFormProps {
  repreneur?: Repreneur
  action: (formData: FormData) => Promise<void>
  submitLabel?: string
}

export function RepreneurForm({ repreneur, action, submitLabel = "Save" }: RepreneurFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedSectors, setSelectedSectors] = useState<string[]>(repreneur?.sector_preferences || [])

  const toggleSector = (value: string) => {
    setSelectedSectors(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    )
  }

  async function handleSubmit(formData: FormData) {
    // Add selected sectors to form data
    formData.delete("sector_preferences")
    formData.append("sector_preferences", JSON.stringify(selectedSectors))

    setIsSubmitting(true)
    try {
      await action(formData)
    } catch (error) {
      console.error("Failed to submit form:", error)
      setIsSubmitting(false)
    }
  }

  return (
    <form action={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{repreneur ? "Edit Repreneur" : "Add New Repreneur"}</CardTitle>
          <CardDescription>
            {repreneur ? "Update repreneur information" : "Enter details for the new repreneur"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input id="first_name" name="first_name" defaultValue={repreneur?.first_name} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input id="last_name" name="last_name" defaultValue={repreneur?.last_name} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" defaultValue={repreneur?.email} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={repreneur?.phone} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                name="linkedin_url"
                type="url"
                placeholder="https://linkedin.com/in/..."
                defaultValue={repreneur?.linkedin_url}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lifecycle_status">Status</Label>
              <Select name="lifecycle_status" defaultValue={repreneur?.lifecycle_status || "lead"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select name="source" defaultValue={repreneur?.source || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source..." />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_background">Company Background</Label>
            <Textarea
              id="company_background"
              name="company_background"
              rows={3}
              defaultValue={repreneur?.company_background}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="investment_capacity">Investment Capacity</Label>
              <Select name="investment_capacity" defaultValue={repreneur?.investment_capacity || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select range..." />
                </SelectTrigger>
                <SelectContent>
                  {INVESTMENT_CAPACITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_acquisition_size">Target Acquisition Size</Label>
              <Select name="target_acquisition_size" defaultValue={repreneur?.target_acquisition_size || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size..." />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_ACQUISITION_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sector Preferences</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
              {INDUSTRY_SECTOR_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sector-${option.value}`}
                    checked={selectedSectors.includes(option.value)}
                    onCheckedChange={() => toggleSector(option.value)}
                  />
                  <label htmlFor={`sector-${option.value}`} className="text-sm cursor-pointer">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_location">Target Location</Label>
            <Select name="target_location" defaultValue={repreneur?.target_location || ""}>
              <SelectTrigger>
                <SelectValue placeholder="Select region..." />
              </SelectTrigger>
              <SelectContent>
                {TARGET_LOCATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* GDPR Consent Section */}
          <div className="border-t pt-6 mt-6">
            <h3 className="text-sm font-medium mb-4">GDPR Consent</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="marketing_consent"
                  name="marketing_consent"
                  defaultChecked={repreneur?.marketing_consent}
                />
                <Label htmlFor="marketing_consent" className="text-sm font-normal">
                  Marketing consent given
                </Label>
              </div>
              {repreneur?.consent_timestamp && (
                <p className="text-xs text-muted-foreground">
                  Consent recorded: {new Date(repreneur.consent_timestamp).toLocaleDateString()}
                  {repreneur.consent_source && ` via ${repreneur.consent_source}`}
                </p>
              )}
              <input type="hidden" name="consent_source" value="manual" />
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
