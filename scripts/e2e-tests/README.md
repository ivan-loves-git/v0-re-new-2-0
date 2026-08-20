# Legacy browser E2E harness — disabled

`scripts/e2e-tests/` is an archived pre-M&A browser harness. It creates and
broad-cleans `TEST_E2E_` records and its selectors and data model no longer
represent the production platform. It is not a supported production, preview,
or shared-database test runner.

The runner now refuses to execute unless all three local-only acknowledgements
are intentionally present:

```text
E2E_BASE_URL=http://localhost:3000
E2E_LEGACY_UNSAFE_ENABLED=I_UNDERSTAND_THIS_IS_LEGACY
E2E_ALLOW_DATA_MUTATION=I_UNDERSTAND_THIS_WILL_CREATE_AND_DELETE_TEST_DATA
```

For supported QA, use `scripts/browser-test-routine.md`, the owned QA personas
defined in `AGENTS.md`, and the current server/Vitest regression suites. Use
the disposable Supabase rehearsal scripts for migration and lifecycle database
validation. Never point this legacy harness at `app.re-new.team`.
