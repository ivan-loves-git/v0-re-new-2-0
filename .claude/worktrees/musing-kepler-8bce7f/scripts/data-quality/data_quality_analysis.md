# Data Quality Analysis: Flatchr Import vs Database

## Executive Summary

**CRITICAL ISSUE FOUND**: The import only captured 43 records, but your file contains ~90+ records. About half of your repreneurs were NOT imported!

---

## Issue 1: Missing Records (CRITICAL)

### Records Imported: 43
### Records in File: ~90+

The import script (`scripts/flatchr-import.sql`) only contains 43 INSERT statements, but your source file has significantly more entries.

### Confirmed NOT Imported (sample from your file):

| Name | Identifier | Application Date | Why Missing |
|------|------------|------------------|-------------|
| Amelie+Lyon | zj8Md60ZwgA9YZ70 | 2025-09-22 | Not in import |
| Ake+Aamakon205@gmail.com | yObP9OgxLRP91ZYB | 2025-09-23 | Not in import |
| 86rjpg7rJ6DpE17e | Strategie De rupture | 2025-09-30 | Not in import |
| AONxpvA08DX9Pg4Q | Qeirthyane Many | 2025-10-02 | Not in import |
| EZBvp5z3ayXdMoVm | Arnaud Duffort | 2025-10-02 | Not in import |
| KJ0MpzwEDeqdXNgx | Antoine Gamberini | 2025-10-04 | Not in import |
| 8oWlpG8ey6Qd63O1 | Mathieu Figueres | 2025-10-05 | Not in import |
| 8q3Bp4lQeJgp0RMg | Aziah Rojehoussen | 2025-10-05 | Not in import |
| zbPjpoaB22enY51y | Frederic Canesso | 2025-10-05 | Not in import |
| xy5JpxrBX8vnz7lV | Zahi Kattar | 2025-10-06 | Not in import |
| Qayv9LL6mab96LXE | Jeimila Six donty | 2025-10-06 | Not in import |
| GYLqn10WAPOdmE0y | Gonzague De torcy | 2025-10-06 | Not in import |
| ENkKd806ZOmd3xYG | Arnaud Laurent-tenaille | 2025-10-06 | Not in import |
| mQNJ9W0gzDJp5LwD | Bertrand De poly | 2025-10-08 | Not in import |
| YJA39J4GQBYdlNQw | Pascal Turcot (2nd entry) | 2025-10-08 | Not in import |
| zbPjpoaBPG3nY51y | Jeremy Ballet | 2025-10-08 | Not in import |
| 86rjpg7XPK6pE17e | Félix Sassiat | 2025-10-08 | Not in import |
| 56Rb9Abx18GpoNZQ | Selim Bellehchili | 2025-10-09 | Not in import |
| 5aMxpQANqo7pGZ2O | Aymeric Mautin | 2025-10-09 | Not in import |
| yObP9OgvB7791ZYB | Albin Juliard | 2025-10-09 | Not in import |
| xy5Jpxr46OEnz7lV | Rochdi Akbi | 2025-10-10 | Not in import |
| AONxpvAeAZk9Pg4Q | Antoine Bordier | 2025-10-10 | Not in import |
| EjyY9lE34jQpZl7o | Younes Karim | 2025-10-11 | Not in import |
| 41QG9eOrPaPdK6Xe | Galdric Donnezan | 2025-10-11 | Not in import |
| AbY1n7GgxVNnLgJN | Timothée Rubino | 2025-10-13 | Not in import |
| QorW9wPQQqkpyelR | Steven Annonziata | 2025-10-13 | Not in import |
| 8q3Bp4l7xyrp0RMg | Alexandre Siboni | 2025-10-13 | Not in import |
| QorW9wPQKlWpyelR | Mathieu Kayser | 2025-10-13 | Not in import |
| Lm5NdDw75Q2pAGbZ | Nicolas Cwyk | 2025-10-13 | Not in import |
| xy5Jpxr4K2Enz7lV | Marie-claire Kanaan | 2025-10-14 | Not in import |
| 8q3Bp4lGW6lp0RMg | Sara Guillaume (2nd) | 2025-10-14 | Duplicate, partial import |
| ENkKd807aXrd3xYG | Moncef Chebli | 2025-10-15 | Not in import |
| 56Rb9AbLwGYpoNZQ | Francois Corrignan | 2025-10-15 | Not in import |
| MQj09ZrN0ej9xoRL | Fabienne Saugier | 2025-10-16 | Not in import |
| lV0D9aLDMzYnWELk | Salek Chskib | 2025-10-20 | Not in import |
| zj8Md602O5l9YZ70 | Thierry Teisseire | 2025-10-21 | Not in import |
| KzqPnNjkAv0n31m0 | Charles-edouard Delpierre | 2025-10-22 | Not in import |
| xy5JpxrN7xrnz7lV | Sophiane Saoudi | 2025-10-23 | Not in import |
| GYLqn10qqZMdmE0y | Romain Garcia | 2025-10-25 | Not in import |
| yVgL9kxXrx4p1PD5 | Henri Flourens | 2025-11-06 | Not in import |
| lV0D9aLGMGxnWELk | Pierre Fournis | 2025-11-13 | Not in import |
| 5aMxpQAzrDLpGZ2O | Paul Fino | 2025-11-21 | Not in import |
| mQNJ9W0zmvrp5LwD | Roch De preneuf | 2025-11-24 | Not in import |
| Lm5NdDwoqgApAGbZ | Ismail Hjjoubi | 2025-10-01 | Not in import |

---

## Issue 2: Missing Q18 Field

Your file has Q18 column but the database schema only goes up to Q17.

**Q18 values observed**: Mostly empty, but some rows have `Oui`

**Question for Bertrand**: What is Q18? It was not imported at all.

---

## Issue 3: Duplicate Entries in Source File

Some people appear multiple times with different timestamps:
- Ignacio222+Campos usle: 3 entries (2025-09-21 21:00, 21:27, 21:31)
- Sara+Guillaume: 2 entries (2025-09-24, 2025-10-14)
- Pascal+Turcot: 2 entries (2025-09-26, 2025-10-08)

**Current handling**: Import used the "latest" entry per flatchr_id, discarding earlier ones.

**Question**: Is this correct behavior? Should we keep history of form resubmissions?

---

## Issue 4: Placeholder Emails

All imported records have placeholder emails like:
`imported-KJ0Mpzw144WdXNgx@placeholder.invalid`

Real emails were NOT in the source file columns you provided.

**Question for Bertrand**: Where are the real email addresses stored in Flatchr? We need a separate export with email addresses.

---

## Issue 5: Questions Needing Clarification

| Question | Current DB Field | What We Need |
|----------|------------------|--------------|
| Q4 | q4_has_ma_experience | Exact French wording of question |
| Q6 | q6_involved_in_ma | How is this different from Q4? |
| Q9 | q9_board_experience | Exact wording - board member or advisory? |
| Q16 | q16_network_training | What do CRA, CCI stand for? Full list of options? |
| Q18 | NOT IMPORTED | What is this question? Why not imported? |

---

## Recommended Next Steps

1. **URGENT**: Re-export from Flatchr with ALL records including those after October 3, 2025
2. **URGENT**: Get email addresses from Flatchr - current export doesn't have them
3. **Clarify**: Answer the question mapping clarifications above
4. **Fix**: Once clarified, re-run import with complete data
5. **Verify**: After re-import, validate record counts match

---

## Files Created

1. `scripts/data-quality/question_mapping.csv` - Question-to-field mapping with clarifications needed
2. `scripts/data-quality/data_quality_analysis.md` - This file

