"use client"

import type React from "react"

import { useState } from "react"
import { createNote } from "@/lib/actions/repreneurs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Note } from "@/lib/types/repreneur"

interface RepreneurNotesProps {
  repreneurId: string
  notes: Note[]
}

export function RepreneurNotes({ repreneurId, notes }: RepreneurNotesProps) {
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    setIsSubmitting(true)
    try {
      await createNote(repreneurId, content)
      setContent("")
    } catch (error) {
      console.error("Failed to create note:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        <CardDescription>Track conversations and important information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea placeholder="Add a note..." value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
          <Button type="submit" disabled={isSubmitting || !content.trim()}>
            {isSubmitting ? "Adding..." : "Add Note"}
          </Button>
        </form>

        <div className="space-y-4">
          {notes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No notes yet</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="border-l-2 border-gray-200 pl-4 py-2">
                <p className="text-sm text-gray-700 leading-relaxed">{note.content}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span>{note.created_by_email}</span>
                  <span>•</span>
                  <span>{new Date(note.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
