"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  discardNextActionGeneration,
  receiveNextActionGeneration,
  recordNextActionFeedback,
  startNextActionGeneration,
  type NextActionFeedback,
} from "@/lib/ai/next-action-ui-state";

type Recommendation = {
  rank: number;
  actionId: string;
  title: string;
  label: string;
  href: string;
  outcomeToken: string;
  rationale: string;
  confidence: "low" | "medium" | "high";
  facts: string[];
  unknowns: string[];
};

export function OpportunityAiNextActions({
  opportunityId,
}: {
  opportunityId: string;
}) {
  const [recommendations, setRecommendations] = useState<
    Recommendation[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generation, setGeneration] = useState(startNextActionGeneration);
  async function askWaveAi() {
    setLoading(true);
    setError(null);
    setRecommendations(null);
    setGeneration(startNextActionGeneration());
    try {
      const response = await fetch("/api/wave-ai/next-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ opportunityId }),
      });
      const data = (await response.json()) as {
        recommendations?: Recommendation[];
        generationId?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "WAVE AI is unavailable.");
      setRecommendations(data.recommendations ?? []);
      setGeneration(receiveNextActionGeneration(data.generationId ?? null));
      if (data.generationId) void lifecycle(data.generationId, "rendered");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "WAVE AI is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function lifecycle(
    id: string,
    eventType:
      | "rendered"
      | "discarded"
      | "feedback_helpful"
      | "feedback_not_helpful",
  ) {
    await fetch("/api/wave-ai/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        generationId: id,
        eventType,
        ...(eventType === "feedback_not_helpful"
          ? { reasonCode: "not_relevant" }
          : {}),
      }),
    });
  }
  function giveFeedback(feedback: NextActionFeedback) {
    const id = generation.generationId;
    if (!id || generation.feedback) return;
    setGeneration((current) => recordNextActionFeedback(current, feedback));
    void lifecycle(id, feedback);
  }
  function discard() {
    const { generationId, next } = discardNextActionGeneration(generation);
    setGeneration(next);
    setRecommendations(null);
    if (generationId) void lifecycle(generationId, "discarded");
  }
  return (
    <Card>
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2">
          <Sparkles />
          WAVE AI next actions
        </CardTitle>
        <CardDescription>
          Optional staff advice. It does not change this opportunity.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-5">
        <div>
          <Button size="sm" onClick={askWaveAi} disabled={loading}>
            {loading ? "Preparing advice…" : "Ask WAVE AI"}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error} Try again or use the deterministic action above.
          </p>
        ) : null}
        {recommendations?.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            WAVE AI found no additional action. Use the recorded opportunity
            state above.
          </p>
        ) : null}
        {recommendations?.map((recommendation) => (
          <section
            key={recommendation.actionId}
            className="rounded-md border p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{recommendation.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Inference: {recommendation.rationale}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`${recommendation.href}${recommendation.href.includes("?") ? "&" : "?"}wave_ai_outcome=${encodeURIComponent(recommendation.outcomeToken)}`}
                >
                  {recommendation.label}
                </Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Rank {recommendation.rank} · Confidence:{" "}
              {recommendation.confidence}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Recorded facts: {recommendation.facts.join(" ")}
            </p>
            {recommendation.unknowns.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Unknowns: {recommendation.unknowns.join(" ")}
              </p>
            ) : null}
          </section>
        ))}
        {generation.generationId ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => giveFeedback("feedback_helpful")}
              disabled={Boolean(generation.feedback)}
            >
              Helpful
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => giveFeedback("feedback_not_helpful")}
              disabled={Boolean(generation.feedback)}
            >
              Not helpful
            </Button>
            <Button size="sm" variant="ghost" onClick={discard}>
              Discard
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
