"use client"

import type React from "react"

import { useState, useOptimistic, useTransition } from "react"
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
    hour: "2-digit",
    minute: "2-digit",
  })
}

type OptimisticAction =
  | { type: "add"; note: Note }
  | { type: "delete"; noteId: string }

export function RepreneurNotes({ repreneurId, notes }: RepreneurNotesProps) {
  const [content, setContent] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [optimisticNotes, updateOptimisticNotes] = useOptimistic(
    notes,
    (state: Note[], action: OptimisticAction) => {
      switch (action.type) {
        case "add":
          return [action.note, ...state]
        case "delete":
          return state.filter((n) => n.id !== action.noteId)
        default:
          return state
      }
    }
  )

  async function handleSubmit() {
    if (!content.trim()) return

    const tempId = `temp-${Date.now()}`
    const optimisticNote: Note = {
      id: tempId,
      repreneur_id: repreneurId,
      content: content.trim(),
      created_at: new Date().toISOString(),
      created_by: "",
      created_by_email: "You",
    }

    setContent("")
    setIsOpen(false)

    startTransition(async () => {
      updateOptimisticNotes({ type: "add", note: optimisticNote })
      try {
        await createNote(repreneurId, content.trim())
      } catch (error) {
        console.error("Failed to create note:", error)
      }
    })
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId)
    startTransition(async () => {
      updateOptimisticNotes({ type: "delete", noteId })
      try {
        await deleteNote(noteId, repreneurId)
      } catch (error) {
        console.error("Failed to delete note:", error)
      } finally {
        setDeletingId(null)
      }
    })
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
              <Button onClick={handleSubmit} disabled={isPending || !content.trim()}>
                {isPending ? "Saving..." : "Save Note"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {optimisticNotes.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-gray-500">No notes yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {optimisticNotes.map((note) => (
              <div
                key={note.id}
                className={`flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50/50 cursor-pointer ${
                  note.id.startsWith("temp-") ? "opacity-70" : ""
                }`}
                onClick={() => setExpandedNote(expandedNote === note.id ? null : note.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm text-gray-700 ${expandedNote === note.id ? "" : "line-clamp-2"}`}>
                    {note.content}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(note.created_at)} by {note.created_by_email}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 ml-2"
                      disabled={deletingId === note.id || note.id.startsWith("temp-")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(note.id)
                      }}
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
