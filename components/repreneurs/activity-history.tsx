"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, Mail, Phone, FileText, CheckCircle, XCircle, Calendar, Trash2, MoreHorizontal, Eye, Activity } from "lucide-react"
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
  DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDistanceToNow } from "date-fns"
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
  const [localActivities, setLocalActivities] = useState<ActivityType_DB[]>(activities)
  const [isOpen, setIsOpen] = useState(false)
  const [activityType, setActivityType] = useState<ActivityType>("welcome_email")
  const [notes, setNotes] = useState("")
  const [durationMinutes, setDurationMinutes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewingActivity, setViewingActivity] = useState<Activity | null>(null)

  // Track if we're in a mutation to prevent useEffect from overwriting optimistic updates
  const isMutatingRef = useRef(false)

  // Sync local state when props change, but only if we're not mid-mutation
  useEffect(() => {
    if (!isMutatingRef.current) {
      setLocalActivities(activities)
    }
  }, [activities])

  async function handleSubmit() {
    const savedNotes = notes
    const savedDuration = durationMinutes
    const savedType = activityType

    // Create optimistic activity
    const tempActivity: ActivityType_DB = {
      id: `temp-${Date.now()}`,
      repreneur_id: repreneurId,
      activity_type: savedType,
      notes: savedNotes || undefined,
      duration_minutes: savedDuration ? parseInt(savedDuration) : undefined,
      created_at: new Date().toISOString(),
      created_by: "",
      created_by_email: "You",
    }

    // Set mutation flag BEFORE state updates
    isMutatingRef.current = true

    // Optimistically update UI
    setLocalActivities(prev => [tempActivity, ...prev])
    setNotes("")
    setDurationMinutes("")
    setActivityType("welcome_email")
    setIsOpen(false)
    setIsSubmitting(true)

    try {
      await createActivity(
        repreneurId,
        savedType,
        savedNotes || undefined,
        savedDuration ? parseInt(savedDuration) : undefined
      )
      await new Promise(resolve => setTimeout(resolve, 100))
      router.refresh()
      setTimeout(() => {
        isMutatingRef.current = false
      }, 500)
    } catch (error) {
      console.error("Failed to create activity:", error)
      // Revert on error
      setLocalActivities(prev => prev.filter(a => a.id !== tempActivity.id))
      isMutatingRef.current = false
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(activityId: string) {
    // Store for potential revert
    const activityToDelete = localActivities.find(a => a.id === activityId)

    // Set mutation flag BEFORE state updates
    isMutatingRef.current = true

    // Optimistically remove
    setLocalActivities(prev => prev.filter(a => a.id !== activityId))
    setDeletingId(activityId)

    try {
      await deleteActivity(activityId, repreneurId)
      await new Promise(resolve => setTimeout(resolve, 100))
      router.refresh()
      setTimeout(() => {
        isMutatingRef.current = false
      }, 500)
    } catch (error) {
      console.error("Failed to delete activity:", error)
      // Revert on error
      if (activityToDelete) {
        setLocalActivities(prev => [activityToDelete, ...prev])
      }
      isMutatingRef.current = false
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
    <Card className="h-full flex flex-col gap-0">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5 text-gray-900" />
          Activity Stream
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
                    {ACTIVITY_TYPES.map((type) => {
                      const IconComponent = type.icon
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      )
                    })}
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
        <div className="space-y-3 overflow-y-auto pr-2" style={{ maxHeight: "380px" }}>
          {localActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No activities logged yet. Click "Log Activity" to add one.
            </p>
          ) : (
            localActivities.map((activity) => {
              const config = getActivityConfig(activity.activity_type)
              const IconComponent = config.icon
              return (
                <div
                  key={activity.id}
                  className={`flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0 ${
                    activity.id.startsWith("temp-") ? "opacity-70" : ""
                  }`}
                >
                  <div className="p-2 rounded-full bg-blue-50 text-blue-600 shrink-0">
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{config.label}</span>
                      {activity.duration_minutes && (
                        <span className="text-xs text-gray-400">{activity.duration_minutes} min</span>
                      )}
                    </div>
                    {activity.notes && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{activity.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      {activity.created_by_email && <span> · by {activity.created_by_email}</span>}
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
                      <DropdownMenuItem onClick={() => setViewingActivity(activity)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </DropdownMenuItem>
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
              return <IconComponent className="h-5 w-5" />
            })()}
            {viewingActivity && getActivityConfig(viewingActivity.activity_type).label}
          </DialogTitle>
          <DialogDescription>
            {viewingActivity && formatDistanceToNow(new Date(viewingActivity.created_at), { addSuffix: true })}
            {viewingActivity?.created_by_email && ` · by ${viewingActivity.created_by_email}`}
            {viewingActivity?.duration_minutes && ` · ${viewingActivity.duration_minutes} minutes`}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {viewingActivity?.notes ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingActivity.notes}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No notes recorded for this activity.</p>
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
