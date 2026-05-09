# Re-New Platform Code Review Findings

**Review Date:** January 9, 2026
**Codebase:** ~29,500 lines TypeScript (Next.js 16 + Supabase)
**Review Agents Used:** 8 specialized reviewers

---

## Summary

| Severity | Count |
|----------|-------|
| P1 Critical | 7 |
| P2 Important | 25 |
| P3 Nice-to-have | 5 |
| **Total** | **37** |

---

## Legend

**Fix Complexity:**
- 🟢 Lo = Quick fix (< 1 hour)
- 🟡 Md = Moderate effort (1-4 hours)
- 🔴 Hi = Significant work (4+ hours)

**Break Risk** (chance of breaking the platform when deploying the fix):
- 🟢 Lo = Safe change, unlikely to cause issues
- 🟡 Md = Some risk, test carefully
- 🔴 Hi = High risk, could take down the app

---

## P1 Critical Findings

| # | Issue | Fix | Break | Why It Matters |
|---|-------|:---:|:-----:|----------------|
| 1 | **Hardcoded password in login page** | 🟢 Lo | 🟢 Lo | Your password `Wave2025!` is visible to anyone who views the website code. It's like writing your house key code on a sign outside your door. Anyone can log in. |
| 2 | **Missing authentication middleware** | 🟡 Md | 🟡 Md | The security guard checks IDs inside each room instead of at the building entrance. Someone might glimpse your client data before being kicked out. |
| 3 | **SQL injection in search** | 🟢 Lo | 🟢 Lo | When users type in search, special characters could trick the database. A hacker could type magic words to see data they shouldn't or crash the search. |
| 4 | **Function signature bug (wasEmailSent)** | 🟢 Lo | 🟢 Lo | The reminder email feature is broken. It checks "was ANY email ever sent" instead of "sent in last 24 hours." People won't get their reminders. |
| 5 | **Missing type property (requiresConsent)** | 🟢 Lo | 🟢 Lo | The system should check GDPR consent before emailing, but this check is silently skipped. You could be emailing people who never agreed to it. |
| 6 | **Race condition in email counter** | 🟡 Md | 🟢 Lo | When 2 emails send at the exact same time, the count might be wrong. Like two cashiers both seeing "10 items" and both writing "9" after a sale. |
| 7 | **Non-atomic cascade delete** | 🟢 Lo | 🟡 Md | Deleting a client removes their notes, offers, activities one by one. If it fails midway, you're left with a half-deleted mess that's hard to clean up. |

---

## P2 Important Findings

### Security

| # | Issue | Fix | Break | Why It Matters |
|---|-------|:---:|:-----:|----------------|
| 8 | **API route missing auth check** | 🟢 Lo | 🟢 Lo | Anyone who knows a client ID can see their info without logging in. Like a filing cabinet where you just need to know the drawer number. |
| 9 | **Webhook signature is optional** | 🟢 Lo | 🟢 Lo | Fake "email delivered" notifications could be sent to mess up your email tracking stats. No way to verify they're real. |
| 10 | **File upload doesn't verify content** | 🟡 Md | 🟢 Lo | Someone could upload a dangerous file disguised as a photo. It's like accepting a package labeled "birthday cake" without checking what's actually inside. |
| 11 | **RLS policies too permissive** | 🟡 Md | 🟡 Md | Database says "anyone logged in can edit any record." Fine for 3 people now, but dangerous if you add more team members or external users. |
| 12 | **Team emails exposed in code** | 🟢 Lo | 🟢 Lo | Team member email addresses are visible in the website source code, making them targets for phishing attacks. |
| 13 | **IDOR in intake actions** | 🟡 Md | 🟢 Lo | Someone could modify another person's questionnaire answers if they guess the ID. No verification that they own that record. |

### Performance

| # | Issue | Fix | Break | Why It Matters |
|---|-------|:---:|:-----:|----------------|
| 14 | **Dashboard fetches data 3x** | 🟡 Md | 🟢 Lo | The dashboard asks the database for the same client list 3 separate times. It's like asking "what time is it?" three times in a row. Wastes time and resources. |
| 15 | **Missing database indexes** | 🟢 Lo | 🟢 Lo | The database has no "card catalog" for common searches. With 100 clients it's fine. With 10,000, searches will take 10 seconds instead of 0.1 seconds. |
| 16 | **No pagination on lists** | 🟡 Md | 🟢 Lo | All clients load at once. With 50 clients = 1 second. With 5,000 clients = 30+ seconds. Users will think the app crashed. |
| 17 | **Heavy chart library (400KB)** | 🟡 Md | 🟢 Lo | The charts library adds 400KB to every page load, even pages without charts. Like shipping the entire encyclopedia when you only need one page. |
| 18 | **82 unnecessary client components** | 🔴 Hi | 🟢 Lo | Many components are marked "run in browser" when they could run on server. More JavaScript = slower page loads, especially on phones. |
| 19 | **N+1 query for milestones** | 🟢 Lo | 🟢 Lo | Getting milestones does one database call per offer instead of one call for all. Like making 5 trips to the store instead of 1 trip. |
| 20 | **Sequential queries in detail page** | 🟢 Lo | 🟢 Lo | The page waits for one database call to finish before starting the next. Could do them all at once and load 2x faster. |

### Code Quality

| # | Issue | Fix | Break | Why It Matters |
|---|-------|:---:|:-----:|----------------|
| 21 | **Widespread `any` types** | 🟡 Md | 🟢 Lo | TypeScript catches bugs early, but `any` turns off the spell-checker. Bugs hide in the code until real users find them. |
| 22 | **Duplicate getEmailStats functions** | 🟢 Lo | 🟢 Lo | Two different versions of the same function exist in different files. Confusing and might accidentally use the wrong one. |
| 23 | **Inconsistent error handling** | 🟡 Md | 🟢 Lo | Some code throws errors, some returns `{success: false}`. No standard way, making bugs harder to track down and fix. |
| 24 | **Duplicate migration numbers** | 🟢 Lo | 🟢 Lo | Two database scripts have the same number (008). Like two chapters both called "Chapter 5." Could run in the wrong order. |

### Data Quality

| # | Issue | Fix | Break | Why It Matters |
|---|-------|:---:|:-----:|----------------|
| 25 | **Missing unique constraint** | 🟢 Lo | 🟢 Lo | The same offer can be assigned to the same client multiple times by accident. Creates duplicate records and confusion in reports. |
| 26 | **No server-side validation** | 🟡 Md | 🟢 Lo | Form validation only runs in the browser. Someone could bypass it and submit garbage data directly to the server. |
| 27 | **Incomplete audit trail** | 🟡 Md | 🟢 Lo | No record of who changed what and when. If something goes wrong, you can't investigate. Also needed for GDPR compliance. |
| 28 | **Non-atomic offer assignment** | 🟡 Md | 🟡 Md | Assigning offer + updating status are 2 separate steps. If the second fails, the client has an offer but the wrong status. Shows up in the wrong pipeline column. |

### Architecture

| # | Issue | Fix | Break | Why It Matters |
|---|-------|:---:|:-----:|----------------|
| 29 | **5 dashboard versions exist** | 🟢 Lo | 🟢 Lo | Four old experimental dashboards still in the code. Confusing, someone might accidentally edit the wrong one. |
| 30 | **No REST API for external tools** | 🔴 Hi | 🟢 Lo | External tools like Zapier or other software can't access your data. You're locked into only using the web interface forever. |
| 31 | **No API documentation** | 🟡 Md | 🟢 Lo | No guide for how to integrate with your system. Makes future development and hand-offs much harder. |
| 32 | **Email system has no retry** | 🟡 Md | 🟢 Lo | If an email fails to send, it's just lost. No automatic retry, no queue, no alert. You won't even know it failed. |

---

## P3 Nice-to-Have

| # | Issue | Fix | Break | Why It Matters |
|---|-------|:---:|:-----:|----------------|
| 33 | **Dead code (~3,000 lines)** | 🟢 Lo | 🟢 Lo | Old experimental code sitting around unused. Like keeping 4 rough drafts mixed in with the final document. Just clutter. |
| 34 | **Unused npm packages** | 🟢 Lo | 🟢 Lo | Paying for magazine subscriptions you never read. Extra install time, bigger downloads, and potential security holes. |
| 35 | **Settings page is just a placeholder** | 🟢 Lo | 🟢 Lo | Page exists but just says "coming soon." Either build it or remove it to avoid confusing users. |
| 36 | **Seed routes available in production** | 🟢 Lo | 🟢 Lo | Test data generator is available on the live site. Someone could accidentally (or intentionally) create fake records. |
| 37 | **Missing image optimization** | 🟢 Lo | 🟢 Lo | Avatar images load at full size instead of being optimized. Slower on mobile, wastes bandwidth. |

---

## Quick Wins

These 7 fixes take ~2 hours total and address critical issues with minimal risk:

| # | Issue | Time | Impact |
|---|-------|------|--------|
| 1 | Remove hardcoded password | 15 min | Closes major security hole |
| 3 | Escape search parameters | 30 min | Prevents SQL injection |
| 4 | Fix wasEmailSent function | 30 min | Makes reminder emails work |
| 8 | Add auth to API route | 15 min | Protects client data |
| 9 | Require webhook signature | 15 min | Prevents fake webhooks |
| 15 | Add database indexes | 30 min | Speeds up all queries |
| 33 | Delete dead code | 30 min | Cleaner codebase |

---

## Files Created

Detailed todo files have been created in `/todos/`:

```
todos/
├── 001-pending-p1-hardcoded-password.md
├── 002-pending-p1-missing-auth-middleware.md
├── 003-pending-p1-sql-injection-search.md
├── 004-pending-p1-function-signature-mismatch.md
├── 005-pending-p1-missing-type-property.md
├── 006-pending-p1-race-condition-email-counter.md
├── 007-pending-p1-non-atomic-delete.md
├── 008-pending-p2-api-route-no-auth.md
├── 009-pending-p2-webhook-signature-optional.md
├── 010-pending-p2-file-upload-security.md
├── 011-pending-p2-dashboard-duplicate-queries.md
├── 012-pending-p2-missing-database-indexes.md
├── 013-pending-p2-any-types-widespread.md
├── 014-pending-p2-no-pagination.md
├── 015-pending-p3-dead-code-dashboards.md
└── 016-pending-p3-unused-dependencies.md
```

Each todo file contains:
- Problem statement with non-technical explanation
- Exact file locations and code snippets
- Multiple solution options with pros/cons
- Acceptance criteria
- Work log template
