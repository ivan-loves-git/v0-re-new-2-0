import type {
  EmailReviewQueueOptions,
  EmailReviewQueueRow,
} from "./review-queue-query"

export function emailReviewSelectionContext(
  options: EmailReviewQueueOptions,
  rows: Array<
    Pick<
      EmailReviewQueueRow,
      "id" | "version" | "archived_at" | "state" | "archive_eligible"
    >
  >,
) {
  // A pure reorder preserves selected identities. A different page, member,
  // version or eligibility state cannot retain any stale/hidden selection.
  return [
    options.view,
    options.page,
    options.search,
    options.purpose,
    rows
      .map(
        (row) =>
          `${row.id}:${row.version}:${row.archived_at ?? "active"}:${row.state}:${row.archive_eligible}`,
      )
      .sort()
      .join(":"),
  ].join("|")
}

export function reviewQueueNavigationParams(
  currentQuery: string,
  options: EmailReviewQueueOptions,
  draftSearch: string,
  changes: Record<string, string | null>,
) {
  const params = new URLSearchParams(currentQuery)
  for (const [name, value] of Object.entries({
    reviewFilter: options.view,
    reviewSearch: draftSearch.trim(),
    reviewPurpose: options.purpose,
    reviewSort: options.sort,
    reviewDirection: options.direction,
    reviewPage: String(options.page),
  }))
    params.set(name, value)
  for (const [name, value] of Object.entries(changes)) {
    if (value === null || value === "") params.delete(name)
    else params.set(name, value)
  }
  if ((params.get("reviewSearch") ?? "") !== options.search)
    params.delete("reviewPage")
  return params
}

export interface ReviewSearchState {
  value: string
  urlValue: string
  revision: number
  submitted: Record<string, number>
}
export type ReviewSearchAction = {
  type: "typed" | "submitted" | "url" | "history"
  value: string
}

export function initialReviewSearch(value: string): ReviewSearchState {
  return { value, urlValue: value, revision: 0, submitted: {} }
}

// A settled request may normalize its own input, but cannot replace words typed
// after it was submitted. Browser history is an explicit new navigation.
export function reviewSearchReducer(
  state: ReviewSearchState,
  action: ReviewSearchAction,
): ReviewSearchState {
  if (action.type === "typed")
    return { ...state, value: action.value, revision: state.revision + 1 }
  if (action.type === "submitted")
    return {
      ...state,
      submitted: { ...state.submitted, [action.value]: state.revision },
    }
  if (action.type === "history")
    return {
      value: action.value,
      urlValue: action.value,
      revision: state.revision + 1,
      submitted: {},
    }
  if (action.value === state.urlValue) return state
  const submittedRevision = state.submitted[action.value]
  const submitted = { ...state.submitted }
  delete submitted[action.value]
  return {
    ...state,
    submitted,
    urlValue: action.value,
    value:
      submittedRevision === undefined || submittedRevision === state.revision
        ? action.value
        : state.value,
  }
}

interface ReviewedMessage {
  id: string
  version: number
  subject: string
  body_text: string
  state: string
}

// This is a read/save handoff only. Confirmation and dispatch are separate user
// actions. Never derive the post-save version in the UI without reading it back.
export async function readReviewedMessageForConfirmation<
  T extends { review: ReviewedMessage },
>(
  original: ReviewedMessage,
  subject: string,
  body: string,
  actions: {
    edit: (
      id: string,
      version: number,
      subject: string,
      body: string,
    ) => Promise<{ success?: boolean }>
    read: (id: string) => Promise<T>
  },
): Promise<T> {
  const changed = subject !== original.subject || body !== original.body_text
  if (changed) {
    const result = await actions.edit(
      original.id,
      original.version,
      subject,
      body,
    )
    if (result.success === false)
      throw new Error("The reviewed text was not saved.")
  }
  const record = await actions.read(original.id)
  const expectedVersion = original.version + (changed ? 1 : 0)
  // Both edit RPCs apply PostgreSQL btrim(text), which removes outer ASCII
  // spaces. Compare those saved words exactly; do not normalize the full body.
  const savedSubject = changed ? subject.replace(/^ +| +$/g, "") : subject
  const savedBody = changed ? body.replace(/^ +| +$/g, "") : body
  if (
    record.review.id !== original.id ||
    record.review.version !== expectedVersion ||
    record.review.subject !== savedSubject ||
    record.review.body_text !== savedBody ||
    record.review.state !== "pending"
  ) {
    throw new Error(
      "The exact reviewed message changed. Reopen it before confirming.",
    )
  }
  return record
}
