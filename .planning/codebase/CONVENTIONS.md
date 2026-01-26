# Coding Conventions

**Analysis Date:** 2026-01-26

## Naming Patterns

**Files:**
- Components: PascalCase with `.tsx` extension (e.g., `EditableTextField.tsx`)
- Utilities: camelCase with `.ts` extension (e.g., `journey-derivation.ts`)
- Types: camelCase with `.ts` extension (e.g., `scoring-v2.ts`)
- Tests: `__tests__` directory with `.test.ts` or `.spec.ts` suffix (e.g., `lib/utils/__tests__/scoring-v2.test.ts`)
- Actions (server): camelCase with `.ts` extension (e.g., `repreneurs.ts`)

**Functions:**
- camelCase for all functions: `calculateDualScore`, `deriveJourneyStage`, `extractMilestones`
- Server actions: camelCase (e.g., `createRepreneur`, `updateRepreneurField`)
- Handler functions: camelCase with descriptive verbs (e.g., `handleSave`, `handleCancel`, `handleKeyDown`)

**Variables:**
- camelCase for all variables: `isEditing`, `optimisticValue`, `isSaving`
- Boolean flags prefixed with `is`, `has`, `can`, `should`: `isSubmitting`, `hasError`
- Event handlers: `handleXxx` pattern (e.g., `handleSave`, `handleCancel`, `handleKeyDown`)

**Types:**
- PascalCase for type names: `Repreneur`, `WhoAnswers`, `WhenAnswers`, `DualScoreResult`
- Union types: descriptive literal values in camelCase with underscores: `'entrepreneur' | 'freelance' | 'employee'`
- Discriminated unions: use string literals matching field values
- Type suffixes: `_Insert` for insert types (e.g., `Repreneur_Insert`)

**Constants:**
- UPPER_SNAKE_CASE for module-level constants: `WHO_POINTS`, `Q11_POINTS`, `TRIANGULATION_MATRIX`
- Array constants: UPPER_SNAKE_CASE (e.g., `MILESTONE_KEYS`)
- Options arrays: UPPER_SNAKE_CASE (e.g., `PERSONA_OPTIONS`, `SOURCE_OPTIONS`)

## Code Style

**Formatting:**
- No explicit formatter configured in project
- 2-space indentation (inferred from codebase)
- Single quotes preferred in JavaScript/TypeScript
- Semicolons required at statement ends

**Linting:**
- No ESLint config found (not enforced)
- Next.js default linting rules apply
- Type strictness: `strict: true` in tsconfig.json enforces strict type checking

**Comments:**
- JSDoc-style comments for public functions and types
- Block comments for section headers (e.g., `// ========== SECTION NAME ==========`)
- Inline comments use `//` for clarity on complex logic
- Comments explain "why" not "what" (code should be self-documenting for what)
- No single-line comments for obvious code

**Example JSDoc pattern:**
```typescript
/**
 * Derive journey stage from milestone count
 * Serial Acquirer requires all 11 milestones (including first acquisition)
 */
export function deriveJourneyStage(
  milestoneCount: number,
  _persona?: string | null | undefined
): JourneyStage
```

## Import Organization

**Order:**
1. React and Next.js imports (`import { useState } from "react"`)
2. External UI library imports (`import { Card } from "@/components/ui/card"`)
3. Internal component imports (`import { FlagBadges } from "@/components/scoring-v2/flag-badges"`)
4. Internal action imports (`import { saveQuestionnaireV2 } from "@/lib/actions/repreneurs"`)
5. Internal utility imports (`import { calculateDualScore } from "@/lib/utils/scoring-v2"`)
6. Internal type imports (`import type { Repreneur } from "@/lib/types/repreneur"`)
7. Constants and config imports (`import { WHO_QUESTIONS } from "@/lib/config/questionnaire-v2"`)

**Path Aliases:**
- All imports use `@/` alias pointing to project root
- No relative imports (e.g., `../` or `./`)
- Configured in `tsconfig.json` paths: `"@/*": ["./*"]`

**Type imports:**
- Always use `import type` for type-only imports: `import type { Repreneur } from "@/lib/types/repreneur"`
- Reduces bundle size and clarifies intent
- Group type imports separately from regular imports

## Error Handling

**Patterns:**
- Try-catch blocks for async operations in server actions
- Error logging uses `console.error()` with context prefix: `console.error("[functionName] Error description:", error)`
- Context prefix format: `[functionName]` shows where error occurred
- Toast notifications for user-facing errors: `toast.error("User-friendly message")`
- Success messages: `toast.success("Action completed")`
- No silent failures - all errors logged or shown to user

**Example pattern from `editable-text-field.tsx`:**
```typescript
try {
  await updateRepreneurField(repreneurId, field, newValue)
  toast.success("Saved successfully")
} catch (error) {
  console.error("Failed to update field:", error)
  toast.error("Failed to save. Please try again.")
  // Revert on error
  setOptimisticValue(null)
  setEditValue(oldValue)
}
```

**Database errors:**
- Check for Supabase error objects with `.message` property
- Log full error objects for debugging: `console.error("[context]", error)`
- Provide meaningful user message (not technical error text)

## Logging

**Framework:** `console` methods (no external logging library)

**Patterns:**
- `console.log()` for info/debug: includes `[functionName]` prefix for context
- `console.error()` for errors: includes `[functionName]` prefix and error object
- Prefix format: `[functionName]` in square brackets for grep-ability
- Log at critical points: function entry, before async calls, after success/failure

**Example from `repreneurs.ts` action:**
```typescript
console.log(`[updateRepreneurField] Updating ${field} for ${id}`)
try {
  // operation
  console.error(`[updateRepreneurField] Database error:`, error)
} finally {
  console.log(`[updateRepreneurField] Revalidation complete`)
}
```

**Guidelines:**
- Avoid excessive logging in loops or frequently-called functions
- Log before/after significant state changes
- Include relevant IDs or values for debugging context
- Never log sensitive data (passwords, tokens)

## Comments

**When to comment:**
- Complex business logic (e.g., triangulation matrix scoring)
- Non-obvious TypeScript patterns (discriminated unions, type guards)
- Algorithm explanations (e.g., scoring calculations)
- Backwards compatibility notes (e.g., `// Kept for backwards compat but no longer used`)

**Block comment style for sections:**
```typescript
// ========================================
// WHO Score Points (Q05-Q10)
// ========================================
```

**JSDoc for exports:**
- All exported functions and types should have JSDoc
- Describe what function does, key parameters, and return type
- Example from `journey-derivation.ts`:
```typescript
/**
 * Count completed milestones
 */
export function countMilestones(milestones: Partial<Tier3Milestones>): number
```

## Function Design

**Size:**
- Prefer functions under 50 lines
- Break into smaller functions if exceeding 100 lines
- Server actions may be longer due to database operations

**Parameters:**
- Prefer 3-4 parameters max
- Use object parameters for 4+ arguments: `function foo(options: { a, b, c, d })`
- Use `type` keyword for parameter objects (e.g., `WhoAnswers`, `WhenAnswers`)

**Return Values:**
- Explicit return types required (enforced by TypeScript)
- Return discriminated union types for success/error: `{ success: true, data } | { success: false, error }`
- Use `null` for "not found" cases (not `undefined`)
- Use typed result objects for complex returns

**Example from `scoring-v2.ts`:**
```typescript
export function calculateDualScore(
  whoAnswers: WhoAnswers,
  whenAnswers: WhenAnswers
): DualScoreResult {
  // Returns fully typed object with who, when, flags, recommendation
}
```

## Module Design

**Exports:**
- Named exports preferred: `export function`, `export type`, `export const`
- Default exports for React components: `export default function ComponentName`
- No mixed named + default exports in same file

**Barrel Files:**
- Not systematically used in this project
- Import directly from source files: `import { foo } from "@/lib/utils/foo"`

**File organization:**
- One main export per file (usually)
- Related utilities grouped in directories: `lib/utils/`, `lib/actions/`, `lib/types/`
- Test files co-located with source: `__tests__/` directory adjacent to source
- Type definitions in separate `lib/types/` directory

## React Conventions

**Component structure:**
- "use client" directive at top of client components
- Props interface defined before component: `interface ComponentProps { ... }`
- Functional components only (no class components)
- Props destructured in function parameters

**Hooks:**
- `useState` for local state
- Custom hooks named with `use` prefix
- Hook dependencies specified in dependency arrays

**Example from `editable-text-field.tsx`:**
```typescript
export function EditableTextField({
  repreneurId,
  field,
  value,
  label,
  type = "text",
  placeholder,
}: EditableTextFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || "")
  // component logic
}
```

---

*Convention analysis: 2026-01-26*
