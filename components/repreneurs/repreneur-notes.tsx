"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, StickyNote, MoreHorizontal, Trash2 } from "lucide-react"
import { createNote, deleteNote } from "@/lib/actions/repreneurs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import type { Note } from "@/lib/types/repreneur"

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

export function RepreneurNotes({ repreneurId, notes }: RepreneurNotesProps) {
  const router = useRouter()
  const [localNotes, setLocalNotes] = useState<Note[]>(notes)
  const [content, setContent] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

    // Create optimistic note
    const tempNote: Note = {
      id: `temp-${Date.now()}`,
      repreneur_id: repreneurId,
      content: savedContent,
      created_at: new Date().toISOString(),
      created_by: "",
      created_by_email: "You",
    }

    // Set mutation flag BEFORE state updates
    isMutatingRef.current = true

    // Optimistically update UI
    setLocalNotes(prev => [tempNote, ...prev])
    setContent("")
    setIsOpen(false)
    setIsSubmitting(true)

    try {
      await createNote(repreneurId, savedContent)
      // Small delay to allow server to process before refresh
      await new Promise(resolve => setTimeout(resolve, 100))
      router.refresh()
      // Keep mutation flag on a bit longer to let the refresh complete
      setTimeout(() => {
        isMutatingRef.current = false
      }, 500)
    } catch (error) {
      console.error("Failed to create note:", error)
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
      await new Promise(resolve => setTimeout(resolve, 100))
      router.refresh()
      setTimeout(() => {
        isMutatingRef.current = false
      }, 500)
    } catch (error) {
      console.error("Failed to delete note:", error)
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Note</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Add a note..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
              />
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
          <div className="space-y-4">
            {localNotes.map((note) => (
              <div
                key={note.id}
                className={`flex items-center justify-between p-4 border rounded-lg ${
                  note.id.startsWith("temp-") ? "opacity-70" : ""
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="font-medium text-sm line-clamp-1">{note.content}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(note.created_at)} · {note.created_by_email}
                  </p>
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
  )
}
