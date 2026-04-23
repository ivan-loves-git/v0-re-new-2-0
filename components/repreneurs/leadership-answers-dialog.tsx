"use client"

import { useState } from "react"
import { Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { BLOC_A_QUESTIONS, BLOC_B_QUESTIONS, BLOC_C_QUESTIONS, LIKERT_LABELS } from "@/lib/config/leadership-assessment"
import type { LeadershipAssessment } from "@/lib/types/leadership-assessment"

interface LeadershipAnswersDialogProps {
  assessment: LeadershipAssessment
}

export function LeadershipAnswersDialog({ assessment }: LeadershipAnswersDialogProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          title="View answers"
        >
          <Eye className="size-3.5 mr-1" />
          Answers
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Leadership assessment — answers</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Bloc A — Leadership Profile */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Bloc A — Leadership Profile
              <Badge variant="outline" className="ml-2 text-xs font-normal">10 A/B choices</Badge>
            </h3>
            <div className="space-y-3">
              {BLOC_A_QUESTIONS.map((q) => {
                const answer = (assessment as unknown as Record<string, string | null>)[q.id]
                const chosen = answer === "A" ? q.optionA : answer === "B" ? q.optionB : null
                return (
                  <div key={q.id} className="border rounded-md p-3 text-sm space-y-1">
                    <p className="font-medium text-foreground">{q.label}</p>
                    {chosen ? (
                      <p className="text-muted-foreground">
                        <Badge variant="secondary" className="mr-2">{answer}</Badge>
                        {chosen.label}
                      </p>
                    ) : (
                      <p className="text-muted-foreground italic">No answer</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Bloc B — Situational Maturity */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Bloc B — Situational Maturity
              <Badge variant="outline" className="ml-2 text-xs font-normal">8 scenarios</Badge>
            </h3>
            <div className="space-y-3">
              {BLOC_B_QUESTIONS.map((q) => {
                const answer = (assessment as unknown as Record<string, string | null>)[q.id]
                const chosen = q.options.find((o) => o.value === answer)
                return (
                  <div key={q.id} className="border rounded-md p-3 text-sm space-y-1">
                    <p className="font-medium text-foreground">{q.situation}</p>
                    {chosen ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Badge variant="secondary">{answer}</Badge>
                        <span>{chosen.label}</span>
                        <Badge
                          variant="outline"
                          className={chosen.score > 0 ? "text-green-700 border-green-200" : chosen.score < 0 ? "text-red-700 border-red-200" : "text-muted-foreground"}
                        >
                          {chosen.score > 0 ? `+${chosen.score}` : chosen.score} · {chosen.tag.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">No answer</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Bloc C — Self-Assessment */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Bloc C — Self-Assessment
              <Badge variant="outline" className="ml-2 text-xs font-normal">8 Likert 1–5</Badge>
            </h3>
            <div className="space-y-2">
              {BLOC_C_QUESTIONS.map((q) => {
                const answer = (assessment as unknown as Record<string, number | null>)[q.id]
                return (
                  <div key={q.id} className="border rounded-md p-3 text-sm flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{q.label}</p>
                      {q.direction === "inverse" && (
                        <p className="text-xs text-muted-foreground mt-0.5">(inverse-scored)</p>
                      )}
                    </div>
                    {answer !== null && answer !== undefined ? (
                      <div className="shrink-0 text-right">
                        <Badge variant="secondary">{answer}/5</Badge>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {LIKERT_LABELS[answer as keyof typeof LIKERT_LABELS]?.en}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic shrink-0">No answer</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
