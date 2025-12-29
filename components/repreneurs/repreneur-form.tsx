"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Repreneur } from "@/lib/types/repreneur"

interface RepreneurFormProps {
  repreneur?: Repreneur
  action: (formData: FormData) => Promise<void>
  submitLabel?: string
}

export function RepreneurForm({ repreneur, action, submitLabel = "Save" }: RepreneurFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
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
              <Input
                id="source"
                name="source"
                placeholder="e.g., Referral, Website, LinkedIn"
                defaultValue={repreneur?.source}
              />
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
              <Input
                id="investment_capacity"
                name="investment_capacity"
                placeholder="e.g., $500K - $2M"
                defaultValue={repreneur?.investment_capacity}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_acquisition_size">Target Acquisition Size</Label>
              <Input
                id="target_acquisition_size"
                name="target_acquisition_size"
                placeholder="e.g., $1M - $5M revenue"
                defaultValue={repreneur?.target_acquisition_size}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sector_preferences">Sector Preferences</Label>
            <Input
              id="sector_preferences"
              name="sector_preferences"
              placeholder="e.g., SaaS, Manufacturing, Healthcare (comma-separated)"
              defaultValue={repreneur?.sector_preferences?.join(", ")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_location">Target Location</Label>
            <Input
              id="target_location"
              name="target_location"
              placeholder="e.g., Northeast US, Remote"
              defaultValue={repreneur?.target_location}
            />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
