# Approved email review prototype reference

[Product Change #221](https://github.com/re-new-team/renew-governance/issues/221) /
[Ticket #222](https://github.com/re-new-team/renew-governance/issues/222).

Ivan's approved 27 September prototype is `src/main.tsx` (SHA-256
`92cb638a4d2353705b5a5920653a5cb7e4b69cd7088c0624fbf6ca085acb4934`) and
`src/styles.css` (SHA-256
`0509f52fbcefba2ad88f1c6bdfef97ffc810c31b49cc96b4711ff97eefd5070a`)
under the private local `email-review-prototype`. The prototype data file
`src/drafts.ts`, its two private snapshots and its customer data are excluded
from application source, fixtures and public references.

The earlier reference to `run-queue.tsx` and `run-queue-columns.tsx` identified
an upstream scaffold, not the approved final screen. The five existing
`queue-*.png` files in this directory are historical synthetic captures of the
released layout that Ivan rejected on 30 September. They do not prove fidelity
or acceptance and must not be presented as the target.

The correction reuses the installed ReUI Radix Vega grid and selection shell,
one version-bound current-page selection, the prototype's column sizes,
group headings, horizontal actions, toolbar/density controls, avatar, purpose
tag, single-line preview, padding and typography. The original light palette
is scoped to this queue and its portals; global Vega tokens and existing Radix
controls are preserved. Real counts, source-derived purposes, timestamps and
provider states replace simulated data truthfully.

Production differences require Ivan's explicit approval: the five-message
send limit and complete per-message acknowledgment/final confirmation, plus
source-specific attachments, retry problems, reply controls and history
behind More details, and fixed workflow copy remaining read-only. No service
limit, authorization, optimistic version, namespace, archive eligibility,
provider identity or uncertainty fence is relaxed. Existing full-page review
and saved batch URLs remain available as deep links; the queue itself opens
Review in a Sheet and sending in a Dialog.

Browser proof of the correction is still required. Source comparison and
synthetic render tests do not establish screenshot parity. Only fictional
`example.invalid` fixtures may be used for candidate visual evidence; no
customer email or real draft mutation is authorized as QA.
