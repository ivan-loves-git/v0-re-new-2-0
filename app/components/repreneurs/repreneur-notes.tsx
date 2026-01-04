"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, StickyNote, MoreHorizontal, Trash2, Phone, Mail, Users, FileText, Eye } from "lucide-react"
import { createNote, deleteNote } from "@/lib/actions/repreneurs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
      return <Phone className="h-4 w-4" />
    case "email":
      return <Mail className="h-4 w-4" />
    case "meeting":
      return <Users className="h-4 w-4" />
    default:
      return <FileText className="h-4 w-4" />
  }
}

function getNoteTypeLabel(noteType: NoteType) {
  const option = NOTE_TYPE_OPTIONS.find(o => o.value === noteType)
  return option?.label || "Other"
}

function getNoteTypeColor(noteType: NoteType) {
  switch (noteType) {
    case "call":
      return "bg-green-100 text-green-700"
    case "email":
      return "bg-blue-100 text-blue-700"
    case "meeting":
      return "bg-purple-100 text-purple-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

export function RepreneurNotes({ repreneurId, notes }: RepreneurNotesProps) {
  const router = useRouter()
  const [localNotes, setLocalNotes] = useState<Note[]>(notes)
  const [content, setContent] = useState("")
  const [noteType, setNoteType] = useState<NoteType>("other")
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewingNote, setViewingNote] = useState<Note | null>(null)

  // Track if we're in a mutation to prevent useEffect from overwriting optimistic updates
  const isMutatingRef = useRef(false)

  // Sync local state when props change, but only if we're not mid-mutation
  useEffect(() => {
    if (!isMutatingRef.current) {
      setLocalNotes(notes)
    }
  }, [notes])

  async function handleSubmit() {
    if (!content.trim()) return

    const savedContent = content.trim()
    const savedType = noteType

    // Create optimistic note
    const tempNote: Note = {
      id: `temp-${Date.now()}`,
      repreneur_id: repreneurId,
      content: savedContent,
      note_type: savedType,
      created_at: new Date().toISOString(),
      created_by: "",
      created_by_email: "You",
    }

    // Set mutation flag BEFORE state updates
    isMutatingRef.current = true

    // Optimistically update UI
    setLocalNotes(prev => [tempNote, ...prev])
    setContent("")
    setNoteType("other")
    setIsOpen(false)
    setIsSubmitting(true)

    try {
      await createNote(repreneurId, savedContent, savedType)
      toast.success("Note added")
      // Small delay to allow server to process before refresh
      await new Promise(resolve => setTimeout(resolve, 100))
      router.refresh()
      // Keep mutation flag on a bit longer to let the refresh complete
      setTimeout(() => {
        isMutatingRef.current = false
      }, 500)
    } catch (error) {
      console.error("Failed to create note:", error)
      toast.error("Failed to add note. Please try again.")
      // Revert on error
      setLocalNotes(prev => prev.filter(n => n.id !== tempNote.id))
      isMutatingRef.current = false
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(noteId: string) {
    // Store for potential revert
    const noteToDelete = localNotes.find(n => n.id === noteId)

    // Set mutation flag BEFORE state updates
    isMutatingRef.current = true

    // Optimistically remove
    setLocalNotes(prev => prev.filter(n => n.id !== noteId))
    setDeletingId(noteId)

    try {
      await deleteNote(noteId, repreneurId)
      toast.success("Note deleted")
      await new Promise(resolve => setTimeout(resolve, 100))
      router.refresh()
      setTimeout(() => {
        isMutatingRef.current = false
      }, 500)
    } catch (error) {
      console.error("Failed to delete note:", error)
      toast.error("Failed to delete note. Please try again.")
      // Revert on error
      if (noteToDelete) {
        setLocalNotes(prev => [noteToDelete, ...prev])
      }
      isMutatingRef.current = false
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notes
          </CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Note
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Note</DialogTitle>
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
                      {NOTE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            {getNoteTypeIcon(option.value as NoteType)}
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
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
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || !content.trim()}>
                  {isSubmitting ? "Saving..." : "Save Note"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {localNotes.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-gray-500">No notes yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {localNotes.map((note) => (
                <div
                  key={note.id}
                  className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
                    note.id.startsWith("temp-") ? "opacity-70" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-full ${getNoteTypeColor(note.note_type || "other")}`}>
                      {getNoteTypeIcon(note.note_type || "other")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          {getNoteTypeLabel(note.note_type || "other")}
                        </span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{formatDate(note.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-1 mt-0.5">{note.content}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 ml-2 flex-shrink-0"
                        disabled={deletingId === note.id || note.id.startsWith("temp-")}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewingNote(note)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(note.id)}
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

      {/* View Note Dialog */}
      <Dialog open={!!viewingNote} onOpenChange={(open) => !open && setViewingNote(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${getNoteTypeColor(viewingNote?.note_type || "other")}`}>
                {getNoteTypeIcon(viewingNote?.note_type || "other")}
              </div>
              {getNoteTypeLabel(viewingNote?.note_type || "other")} Note
            </DialogTitle>
            <DialogDescription>
              {viewingNote && formatDate(viewingNote.created_at)} · {viewingNote?.created_by_email || "Unknown"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingNote?.content}</p>
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
