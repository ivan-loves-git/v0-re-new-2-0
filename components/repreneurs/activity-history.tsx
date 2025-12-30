"use client"

import { useState, useOptimistic, useTransition } from "react"
import { Plus, Mail, Phone, FileText, CheckCircle, XCircle, Calendar, Trash2, MoreHorizontal } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

type OptimisticAction =
  | { type: "add"; activity: Activity }
  | { type: "delete"; activityId: string }

export function ActivityHistory({ repreneurId, activities }: ActivityHistoryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activityType, setActivityType] = useState<ActivityType>("welcome_email")
  const [notes, setNotes] = useState("")
  const [durationMinutes, setDurationMinutes] = useState("")
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [optimisticActivities, updateOptimisticActivities] = useOptimistic(
    activities,
    (state: Activity[], action: OptimisticAction) => {
      switch (action.type) {
        case "add":
          return [action.activity, ...state]
        case "delete":
          return state.filter((a) => a.id !== action.activityId)
        default:
          return state
      }
    }
  )

  async function handleSubmit() {
    const tempId = `temp-${Date.now()}`
    const optimisticActivity: Activity = {
      id: tempId,
      repreneur_id: repreneurId,
      activity_type: activityType,
      notes: notes || null,
      duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
      created_at: new Date().toISOString(),
      created_by: "",
      created_by_email: "You",
    }

    const savedNotes = notes
    const savedDuration = durationMinutes
    const savedType = activityType

    setNotes("")
    setDurationMinutes("")
    setActivityType("welcome_email")
    setIsOpen(false)

    startTransition(async () => {
      updateOptimisticActivities({ type: "add", activity: optimisticActivity })
      try {
        await createActivity(
          repreneurId,
          savedType,
          savedNotes || undefined,
          savedDuration ? parseInt(savedDuration) : undefined
        )
      } catch (error) {
        console.error("Failed to create activity:", error)
      }
    })
  }

  async function handleDelete(activityId: string) {
    setDeletingId(activityId)
    startTransition(async () => {
      updateOptimisticActivities({ type: "delete", activityId })
      try {
        await deleteActivity(activityId, repreneurId)
      } catch (error) {
        console.error("Failed to delete activity:", error)
      } finally {
        setDeletingId(null)
      }
    })
  }

  return (
    <Card className="h-full flex flex-col">
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
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? "Saving..." : "Save Activity"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {optimisticActivities.length === 0 ? (
          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            <p className="text-sm text-gray-500 text-center">
              No activities logged yet. Click "Log Activity" to add one.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {optimisticActivities.map((activity) => (
              <div
                key={activity.id}
                className={`flex items-center justify-between p-4 border rounded-lg ${
                  activity.id.startsWith("temp-") ? "opacity-70" : ""
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {getActivityLabel(activity.activity_type)}
                    </span>
                    {activity.duration_minutes && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {activity.duration_minutes} min
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatDate(activity.created_at)} · {activity.created_by_email}
                    {activity.notes && ` · ${activity.notes}`}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      disabled={deletingId === activity.id || activity.id.startsWith("temp-")}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleDelete(activity.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
