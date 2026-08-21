export type QuestionnaireLoadState = "loading" | "ready" | "not_found" | "error"

export function questionnaireLoadStateForResponse(response: Pick<Response, "ok" | "status">): QuestionnaireLoadState {
  if (response.ok) return "ready"
  return response.status === 404 ? "not_found" : "error"
}
