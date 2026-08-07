export type NextActionFeedback = "feedback_helpful" | "feedback_not_helpful";

export type NextActionUiState = {
  generationId: string | null;
  feedback: NextActionFeedback | null;
};

/** A new request invalidates all feedback controls from the earlier advice. */
export function startNextActionGeneration(): NextActionUiState {
  return { generationId: null, feedback: null };
}

export function receiveNextActionGeneration(
  generationId: string | null,
): NextActionUiState {
  return { generationId, feedback: null };
}

/** Each generation can receive one feedback signal and one discard signal. */
export function selectNextActionFeedback(
  state: NextActionUiState,
  feedback: NextActionFeedback,
): string | null {
  if (!feedback || !state.generationId || state.feedback) return null;
  return state.generationId;
}

export function recordNextActionFeedback(
  state: NextActionUiState,
  feedback: NextActionFeedback,
): NextActionUiState {
  if (!selectNextActionFeedback(state, feedback)) return state;
  return { ...state, feedback };
}

export function discardNextActionGeneration(state: NextActionUiState): {
  generationId: string | null;
  next: NextActionUiState;
} {
  return {
    generationId: state.generationId,
    next: startNextActionGeneration(),
  };
}
