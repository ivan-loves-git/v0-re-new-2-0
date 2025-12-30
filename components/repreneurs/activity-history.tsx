"use client"

import { useState } from "react"
import { Plus, Mail, Phone, FileText, CheckCircle, XCircle, Calendar, Trash2 } from "lucide-react"
import { createActivity, deleteActivity } from "@/lib/actions/activities"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import type { Activity, ActivityType } from "@/lib/types/repreneur"

interface ActivityHistoryProps {
  repreneurId: string
  activities: Activity[]
}

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: React.ReactNode }[] = [
  { value: "welcome_email", label: "Welcome Email", icon: <Mail className="h-4 w-4" /> },
  { value: "interview", label: "Interview", icon: <Phone className="h-4 w-4" /> },
  { value: "offer_submitted", label: "Offer Submitted", icon: <FileText className="h-4 w-4" /> },
  { value: "offer_approved", label: "Offer Approved", icon: <CheckCircle className="h-4 w-4" /> },
  { value: "offer_rejected", label: "Offer Rejected", icon: <XCircle className="h-4 w-4" /> },
  { value: "meeting", label: "Meeting", icon: <Calendar className="h-4 w-4" /> },
]

function getActivityIcon(type: ActivityType) {
  const activityType = ACTIVITY_TYPES.find((t) => t.value === type)
  return activityType?.icon || <FileText className="h-4 w-4" />
}

function getActivityLabel(type: ActivityType) {
  const activityType = ACTIVITY_TYPES.find((t) => t.value === type)
  return activityType?.label || type
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ActivityHistory({ repreneurId, activities }: ActivityHistoryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activityType, setActivityType] = useState<ActivityType>("welcome_email")
  const [notes, setNotes] = useState("")
  const [durationMinutes, setDurationMinutes] = useState("")

  async function handleSubmit() {
    setIsSubmitting(true)
    try {
      await createActivity(
        repreneurId,
        activityType,
        notes || undefined,
        durationMinutes ? parseInt(durationMinutes) : undefined
      )
      setNotes("")
      setDurationMinutes("")
      setActivityType("welcome_email")
      setIsOpen(false)
    } catch (error) {
      console.error("Failed to create activity:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(activityId: string) {
    if (!confirm("Are you sure you want to delete this activity?")) return
    try {
      await deleteActivity(activityId, repreneurId)
    } catch (error) {
      console.error("Failed to delete activity:", error)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Activity History
        </CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Log Activity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Activity</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Activity Type</Label>
                <Select
                  value={activityType}
                  onValueChange={(value) => setActivityType(value as ActivityType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          {type.icon}
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any relevant notes..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes, optional)</Label>
                <Input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="e.g., 30"
                  min="1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Activity"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No activities logged yet. Click "Log Activity" to add one.
          </p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50/50"
              >
                <div className="mt-0.5 p-2 rounded-full bg-white border">
                  {getActivityIcon(activity.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {getActivityLabel(activity.activity_type)}
                    </span>
                    {activity.duration_minutes && (
                      <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                        {activity.duration_minutes} min
                      </span>
                    )}
                  </div>
                  {activity.notes && (
                    <p className="text-sm text-gray-600 mt-1">{activity.notes}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(activity.created_at)} by {activity.created_by_email}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(activity.id)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
