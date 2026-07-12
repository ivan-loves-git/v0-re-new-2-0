"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Mail, Phone, FileText, CheckCircle, XCircle, Calendar, Trash2, MoreHorizontal, Eye, Activity } from "lucide-react"
import { createActivity, deleteActivity } from "@/lib/actions/activities"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectGroup,
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
  DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDistanceToNow, format } from "date-fns"
import type { Activity as ActivityType_DB, ActivityType } from "@/lib/types/repreneur"

interface ActivityHistoryProps {
  repreneurId: string
  activities: ActivityType_DB[]
}

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: React.ElementType }[] = [
  { value: "welcome_email", label: "Welcome Email", icon: Mail },
  { value: "interview", label: "Interview", icon: Calendar },
  { value: "offer_submitted", label: "Offer Submitted", icon: FileText },
  { value: "offer_approved", label: "Offer Approved", icon: CheckCircle },
  { value: "offer_rejected", label: "Offer Rejected", icon: XCircle },
  { value: "meeting", label: "Meeting", icon: Phone },
]

function getActivityConfig(type: ActivityType) {
  return ACTIVITY_TYPES.find((t) => t.value === type) || { value: type, label: type, icon: Activity }
}

export function ActivityHistory({ repreneurId, activities }: ActivityHistoryProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [activityType, setActivityType] = useState<ActivityType>("welcome_email")
  const [notes, setNotes] = useState("")
  const [durationMinutes, setDurationMinutes] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewingActivity, setViewingActivity] = useState<ActivityType_DB | null>(null)

  async function handleSubmit() {
    setIsSubmitting(true)

    try {
      await createActivity(
        repreneurId,
        activityType,
        notes || undefined,
        durationMinutes ? parseInt(durationMinutes) : undefined,
        eventDate || undefined
      )
      toast.success("Activity logged")
      setNotes("")
      setDurationMinutes("")
      setEventDate("")
      setActivityType("welcome_email")
      setIsOpen(false)
      router.refresh()
    } catch (error) {
      console.error("Failed to create activity:", error)
      toast.error("Failed to log activity. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(activityId: string) {
    setDeletingId(activityId)

    try {
      await deleteActivity(activityId, repreneurId)
      toast.success("Activity deleted")
      router.refresh()
    } catch (error) {
      console.error("Failed to delete activity:", error)
      toast.error("Failed to delete activity. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
    <Card className="flex h-full flex-col gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b py-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          Activity stream
        </CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" data-icon="inline-start" />
              Log activity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log activity</DialogTitle>
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
                    <SelectGroup>
        {ACTIVITY_TYPES.map((type) => {
          const IconComponent = type.icon
          return (
            <SelectItem key={type.value} value={type.value}>
              <div className="flex items-center gap-2">
                <IconComponent className="size-4" />
                {type.label}
              </div>
            </SelectItem>
          )
        })}
                    </SelectGroup>
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
              <div className="space-y-2">
                <Label>Event date (optional)</Label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save activity"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="py-2">
        <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
          {activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No activities logged yet. Click "Log Activity" to add one.
            </p>
          ) : (
            activities.map((activity) => {
              const config = getActivityConfig(activity.activity_type)
              const IconComponent = config.icon
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 border-b py-3 first:pt-1 last:border-0 last:pb-1"
                >
                  <div className="shrink-0 rounded-md border bg-muted/60 p-2 text-muted-foreground">
                    <IconComponent className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{config.label}</span>
                      {activity.duration_minutes && (
                        <span className="text-xs text-muted-foreground">{activity.duration_minutes} min</span>
                      )}
                    </div>
                    {activity.notes && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{activity.notes}</p>
                    )}
                    {activity.event_date && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                        <Calendar className="size-3" />
                        {format(new Date(activity.event_date), "MMM d, yyyy")}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      {format(new Date(activity.created_at), "MMM d 'at' HH:mm")} ({formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })})
                      {activity.created_by_email && <span> · by {activity.created_by_email}</span>}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="flex-shrink-0"
                        disabled={deletingId === activity.id}
                        aria-label={`Actions for ${config.label}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewingActivity(activity)}>
                        <Eye className="size-4" data-icon="inline-start" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(activity.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4" data-icon="inline-start" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>

    {/* View Activity Dialog */}
    <Dialog open={!!viewingActivity} onOpenChange={(open) => !open && setViewingActivity(null)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {viewingActivity && (() => {
              const config = getActivityConfig(viewingActivity.activity_type)
              const IconComponent = config.icon
              return <IconComponent className="size-5" />
            })()}
            {viewingActivity && getActivityConfig(viewingActivity.activity_type).label}
          </DialogTitle>
          <DialogDescription>
            {viewingActivity && format(new Date(viewingActivity.created_at), "MMM d 'at' HH:mm")} ({viewingActivity && formatDistanceToNow(new Date(viewingActivity.created_at), { addSuffix: true })})
            {viewingActivity?.created_by_email && ` · by ${viewingActivity.created_by_email}`}
            {viewingActivity?.duration_minutes && ` · ${viewingActivity.duration_minutes} minutes`}
            {viewingActivity?.event_date && ` · Event: ${format(new Date(viewingActivity.event_date), "MMM d, yyyy")}`}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {viewingActivity?.notes ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{viewingActivity.notes}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">No notes recorded for this activity.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setViewingActivity(null)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
