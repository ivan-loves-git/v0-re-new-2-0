---
status: complete
date: 2026-05-18
---

# Save Feedback Toast Standard

## Goal

Make the successful-save banner Ivan liked the default visual feedback pattern for saved changes across the platform.

## Scope

- Style the shared Sonner toaster globally so existing `toast.success(...)` calls inherit the same green banner treatment.
- Keep errors visually distinct with the same shared toaster.
- Remove duplicate inline success feedback from the opportunity recommendation form while preserving inline error guidance.

## Result

Implemented in the shared app layout and the opportunity recommendation form.
