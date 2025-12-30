"use client"

import type React from "react"

import { useState } from "react"
import { Plus, StickyNote } from "lucide-react"
import { createNote } from "@/lib/actions/repreneurs"
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
import type { Note } from "@/lib/types/repreneur"

interface RepreneurNotesProps {
  repreneurId: string
  notes: Note[]
}

export function RepreneurNotes({ repreneurId, notes }: RepreneurNotesProps) {
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  async function handleSubmit() {
    if (!content.trim()) return

    setIsSubmitting(true)
    try {
      await createNote(repreneurId, content)
      setContent("")
      setIsOpen(false)
    } catch (error) {
      console.error("Failed to create note:", error)
    } finally {
      setIsSubmitting(false)
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
        {notes.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-gray-500">No notes yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="border-l-2 border-gray-200 pl-4 py-2">
                <p className="text-sm text-gray-700 leading-relaxed">{note.content}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span>{note.created_by_email}</span>
                  <span>•</span>
                  <span>{new Date(note.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
