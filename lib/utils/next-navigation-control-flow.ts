import { unstable_rethrow } from "next/navigation"

/**
 * Preserve Next.js navigation signals thrown by server actions.
 *
 * `redirect()` deliberately throws to stop the action. Treating that signal as
 * a form error creates false console and analytics failures after a save.
 */
export function rethrowNextNavigationControlFlow(error: unknown) {
  unstable_rethrow(error)
}
