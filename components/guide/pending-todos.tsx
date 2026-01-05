"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, User, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { pendingTodos, type TodoItem } from "@/lib/data/todos"

function TodoCard({ todo, isExpanded, onToggle }: { todo: TodoItem; isExpanded: boolean; onToggle: () => void }) {
  const formattedDate = new Date(todo.submittedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <Card className="border-red-200 bg-red-50/50 hover:shadow-md transition-shadow py-0">
      <CardContent className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-xs py-0">
                {todo.priority}
              </Badge>
              <span className="text-xs text-gray-500">{todo.category}</span>
            </div>
            <h3 className="font-medium text-gray-900 text-sm mt-1">{todo.title}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {todo.owner}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formattedDate}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="flex-shrink-0 h-8 w-8"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-red-200 space-y-3">
            <p className="text-sm text-gray-600">{todo.description}</p>

            {todo.steps && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 bg-white/50 rounded-lg p-3">
                  {todo.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {todo.links && todo.links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {todo.links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PendingTodos() {
  const [showAll, setShowAll] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const pending = pendingTodos.filter(t => t.status === "pending")
  const displayedTodos = showAll ? pending : pending.slice(0, 2)
  const hasMore = pending.length > 2

  if (pending.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-gray-900">Action Required</h2>
          <Badge variant="destructive" className="text-xs">
            {pending.length} pending
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        {displayedTodos.map((todo) => (
          <TodoCard
            key={todo.id}
            todo={todo}
            isExpanded={expandedId === todo.id}
            onToggle={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
          />
        ))}
      </div>

      {hasMore && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="w-full"
        >
          {showAll ? "Show less" : `Show ${pending.length - 2} more`}
        </Button>
      )}
    </div>
  )
}
