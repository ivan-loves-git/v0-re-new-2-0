"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, StickyNote, MoreHorizontal, Trash2, Phone, Mail, Users, FileText, Eye } from "lucide-react"
import { createNote, deleteNote } from "@/lib/actions/repreneurs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import type { Note, NoteType } from "@/lib/types/repreneur"
import { NOTE_TYPE_OPTIONS } from "@/lib/types/repreneur"

interface RepreneurNotesProps {
  repreneurId: string
  notes: Note[]
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getNoteTypeIcon(noteType: NoteType) {
  switch (noteType) {
    case "call":
      return <Phone className="size-4" />
    case "email":
      return <Mail className="size-4" />
    case "meeting":
      return <Users className="size-4" />
    default:
      return <FileText className="size-4" />
  }
}

function getNoteTypeLabel(noteType: NoteType) {
  const option = NOTE_TYPE_OPTIONS.find(o => o.value === noteType)
  return option?.label || "Other"
}

function getNoteTypeColor(noteType: NoteType) {
  switch (noteType) {
    case "call":
      return "border-success/20 bg-success/5 text-success"
    case "email":
      return "border-info/20 bg-info/5 text-info"
    case "meeting":
      return "border-primary/20 bg-primary/5 text-primary"
    default:
      return "border-border bg-muted/60 text-muted-foreground"
  }
}

export function RepreneurNotes({ repreneurId, notes }: RepreneurNotesProps) {
  const router = useRouter()
  const [content, setContent] = useState("")
  const [noteType, setNoteType] = useState<NoteType>("other")
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewingNote, setViewingNote] = useState<Note | null>(null)

  async function handleSubmit() {
    if (!content.trim()) return

    setIsSubmitting(true)

    try {
      await createNote(repreneurId, content.trim(), noteType)
      toast.success("Note added")
      setContent("")
      setNoteType("other")
      setIsOpen(false)
      router.refresh()
    } catch (error) {
      console.error("Failed to create note:", error)
      toast.error("Failed to add note. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId)

    try {
      await deleteNote(noteId, repreneurId)
      toast.success("Note deleted")
      router.refresh()
    } catch (error) {
      console.error("Failed to delete note:", error)
      toast.error("Failed to delete note. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b py-3">
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="size-4 text-muted-foreground" />
            Notes
          </CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" data-icon="inline-start" />
                Add note
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add note</DialogTitle>
                <DialogDescription>
                  Record an interaction or observation about this candidate.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="note-type">Type</Label>
                  <Select value={noteType} onValueChange={(v) => setNoteType(v as NoteType)}>
                    <SelectTrigger id="note-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
        {NOTE_TYPE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {getNoteTypeIcon(option.value as NoteType)}
              {option.label}
            </div>
          </SelectItem>
        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note-content">Content</Label>
                  <Textarea
                    id="note-content"
                    placeholder="Write your note here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || !content.trim()}>
                  {isSubmitting ? "Saving..." : "Save note"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="py-2">
          {notes.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">No notes yet</p>
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center justify-between border-b px-1 py-3 transition-colors first:pt-1 last:border-0 last:pb-1 hover:bg-muted/35"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className={`rounded-md border p-2 ${getNoteTypeColor(note.note_type || "other")}`}>
                      {getNoteTypeIcon(note.note_type || "other")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {getNoteTypeLabel(note.note_type || "other")}
                        </span>
                        <span className="text-xs text-muted-foreground/60">·</span>
                        <span className="text-xs text-muted-foreground">{formatDate(note.created_at)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-sm text-foreground">{note.content}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="ml-2 flex-shrink-0"
                        disabled={deletingId === note.id}
                        aria-label={`Actions for ${getNoteTypeLabel(note.note_type || "other")} note`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewingNote(note)}>
                        <Eye className="size-4" data-icon="inline-start" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(note.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4" data-icon="inline-start" />
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

      {/* View Note Dialog */}
      <Dialog open={!!viewingNote} onOpenChange={(open) => !open && setViewingNote(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`rounded-md border p-1.5 ${getNoteTypeColor(viewingNote?.note_type || "other")}`}>
                {getNoteTypeIcon(viewingNote?.note_type || "other")}
              </span>
              {getNoteTypeLabel(viewingNote?.note_type || "other")} Note
            </DialogTitle>
            <DialogDescription>
              {viewingNote && formatDate(viewingNote.created_at)} · {viewingNote?.created_by_email || "Unknown"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{viewingNote?.content}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingNote(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
