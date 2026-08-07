import { describe, expect, it } from "vitest";
import {
  discardNextActionGeneration,
  receiveNextActionGeneration,
  recordNextActionFeedback,
  selectNextActionFeedback,
  startNextActionGeneration,
} from "@/lib/ai/next-action-ui-state";

describe("WAVE AI next-action UI lifecycle", () => {
  it("records rendered advice as a fresh generation and clears stale feedback for a new request", () => {
    const prior = recordNextActionFeedback(
      receiveNextActionGeneration("generation-a"),
      "feedback_helpful",
    );
    expect(startNextActionGeneration()).toEqual({
      generationId: null,
      feedback: null,
    });
    expect(receiveNextActionGeneration("generation-b")).toEqual({
      generationId: "generation-b",
      feedback: null,
    });
    expect(prior.feedback).toBe("feedback_helpful");
  });

  it("allows one feedback event, then discards the rendered advice and its controls", () => {
    const state = receiveNextActionGeneration("generation-a");
    expect(selectNextActionFeedback(state, "feedback_not_helpful")).toBe(
      "generation-a",
    );
    const rated = recordNextActionFeedback(state, "feedback_not_helpful");
    expect(selectNextActionFeedback(rated, "feedback_helpful")).toBeNull();
    expect(discardNextActionGeneration(rated)).toEqual({
      generationId: "generation-a",
      next: { generationId: null, feedback: null },
    });
  });
});
