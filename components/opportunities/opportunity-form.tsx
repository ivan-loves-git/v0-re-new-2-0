"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  MA_SOURCE_TYPE_OPTIONS,
  OPPORTUNITY_STATUS_OPTIONS,
  OPPORTUNITY_VISIBILITY_OPTIONS,
  type OpportunityWithSource,
} from "@/lib/types/opportunity"

interface OpportunityFormProps {
  opportunity?: OpportunityWithSource
  action: (formData: FormData) => Promise<void>
  submitLabel?: string
}

export function OpportunityForm({ opportunity, action, submitLabel = "Save opportunity" }: OpportunityFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true)
    try {
      await action(formData)
    } catch (error) {
      console.error("Failed to save opportunity:", error)
      setIsSubmitting(false)
    }
  }

  return (
    <form action={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{opportunity ? "Edit opportunity" : "Create opportunity"}</CardTitle>
          <CardDescription>Keep staff-only source data separate from repreneur-visible information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <input type="hidden" name="source_id" value={opportunity?.source_id ?? ""} />

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Core fields</h3>
              <p className="text-sm text-muted-foreground">Operational data used by the Re-New team.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reference">Reference *</Label>
                <Input id="reference" name="reference" defaultValue={opportunity?.reference ?? ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={opportunity?.status ?? "draft"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {OPPORTUNITY_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sector">Sector</Label>
                <Input id="sector" name="sector" defaultValue={opportunity?.sector ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity">Activity</Label>
                <Input id="activity" name="activity" defaultValue={opportunity?.activity ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" defaultValue={opportunity?.location ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_added">Date added</Label>
                <Input id="date_added" name="date_added" type="date" defaultValue={opportunity?.date_added ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenue_meur">Revenue (M EUR)</Label>
                <Input id="revenue_meur" name="revenue_meur" type="number" step="0.01" defaultValue={opportunity?.revenue_meur ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ebitda_keur">EBITDA (K EUR)</Label>
                <Input id="ebitda_keur" name="ebitda_keur" type="number" step="0.01" defaultValue={opportunity?.ebitda_keur ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="headcount">Headcount</Label>
                <Input id="headcount" name="headcount" type="number" min="0" defaultValue={opportunity?.headcount ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Staff description</Label>
              <Textarea id="description" name="description" rows={4} defaultValue={opportunity?.description ?? ""} />
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <div>
              <h3 className="text-sm font-medium">Repreneur-visible version</h3>
              <p className="text-sm text-muted-foreground">Use anonymized content until disclosure is explicitly approved.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="repreneur_visibility">Visibility</Label>
                <Select name="repreneur_visibility" defaultValue={opportunity?.repreneur_visibility ?? "anonymized"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {OPPORTUNITY_VISIBILITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="public_title">Public title</Label>
                <Input id="public_title" name="public_title" defaultValue={opportunity?.public_title ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="anonymized_description">Anonymized description</Label>
              <Textarea id="anonymized_description" name="anonymized_description" rows={3} defaultValue={opportunity?.anonymized_description ?? ""} />
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <div>
              <h3 className="text-sm font-medium">Staff-only M&A source</h3>
              <p className="text-sm text-muted-foreground">Minimal source/contact context. Not a CRM.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="source_firm_name">Firm / source</Label>
                <Input id="source_firm_name" name="source_firm_name" defaultValue={opportunity?.source?.firm_name ?? opportunity?.source_label ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_type">Source type</Label>
                <Select name="source_type" defaultValue={opportunity?.source?.source_type ?? "ma_firm"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {MA_SOURCE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_contact_name">Contact name</Label>
                <Input id="source_contact_name" name="source_contact_name" defaultValue={opportunity?.source?.contact_name ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_contact_email">Contact email</Label>
                <Input id="source_contact_email" name="source_contact_email" type="email" defaultValue={opportunity?.source?.contact_email ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_contact_phone">Contact phone</Label>
                <Input id="source_contact_phone" name="source_contact_phone" defaultValue={opportunity?.source?.contact_phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_visibility">Source visibility</Label>
                <Select name="source_visibility" defaultValue={opportunity?.source_visibility ?? "staff_only"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {OPPORTUNITY_VISIBILITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source_notes">Source notes</Label>
              <Textarea id="source_notes" name="source_notes" rows={3} defaultValue={opportunity?.source?.notes ?? ""} />
            </div>
          </section>

          <section className="space-y-4 border-t pt-6">
            <div className="space-y-2">
              <Label htmlFor="staff_notes">Staff notes</Label>
              <Textarea id="staff_notes" name="staff_notes" rows={3} defaultValue={opportunity?.staff_notes ?? ""} />
            </div>
          </section>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
