# Guide for Amelie & Bertrand: Building Your Questionnaire with ChatGPT

## Why This Approach?

The traditional workflow would be:

1. You design questions in Excel →
2. Ivan interprets your Excel →
3. Ivan codes it into the platform →
4. You test and find issues →
5. Back to step 1

**The problem:** Every iteration requires everyone's time, plus lost time in communications. And some nuances get lost in translation - especially the triangulation logic and pivot questions you've designed.

**The better approach:** You build an interactive prototype directly in ChatGPT that:

- Lets you *experience* the questionnaire as a candidate would
- Shows you the scoring in real-time so you can validate it works
- Once validated, exports clean code that Ivan can implement directly

ChatGPT Pro has a feature called **Canvas** (similar to Claude's Artifacts) that can generate interactive web applications. You'll use this to create a working version of your questionnaire.

---

## Prompt 1: Upload Your Master File and Let the AI Challenge You

Take your master file (Excel, Google Sheet, or however you've documented the questions, options, and scoring) and upload it to ChatGPT with this prompt:

```
I'm attaching my master file for a candidate screening questionnaire. It contains:
- All questions
- The question types (dropdown, multi-select, text, file upload, etc.)
- The possible answers for each question
- The scoring logic

Before you build anything, I need you to review this file and challenge me on everything that is not 100% clear. Ask me questions about:
- Any scoring rules that seem ambiguous or incomplete
- Any logic that could be interpreted multiple ways
- Any missing information you would need to build this correctly
- Any edge cases I might not have considered

Only once you have asked all your questions and I have answered them, and you are confident you understand everything, then you can proceed to build the interactive form.
```

Answer all the AI's questions. This is important - it will surface gaps in your logic before you start testing.

---

## Prompt 2: Build the Interactive Form

Once the AI confirms it understands everything:

```
Now please create an interactive questionnaire prototype as a web application in Canvas.

The form should:
1. Show questions in a logical flow
2. Calculate both scores (WHO and WHEN) in real-time
3. At the end, display:
   - WHO Score: X/100
   - WHEN Score: X/100
   - Any flags (e.g., "Incoherent thesis detected")
   - Recommended action (e.g., "Send Starter Pack" / "Priority for interview" / "Advanced candidate")

All text should be in French.
```

---

## Your Testing Loop

Once ChatGPT generates the interactive form:

1. Fill it out as a strong candidate → Check if scores match your expectations
2. Fill it out as a weak candidate → Check again
3. Fill it out with an incoherent thesis → Does the flag trigger?
4. Tell ChatGPT what to change
5. Repeat until it works

Test 5, 10, 15 times if needed. This is where you validate your logic.

---

## Prompt 3: Export for Ivan

Once you're satisfied:

```
The questionnaire and scoring logic are now validated.

Please export everything in a structured format that another developer can use to implement it:

1. JSON Schema containing:
   - All questions with their ID, text, type
   - All possible answers with their score values
   - All scoring rules (pivot questions, triangulation, penalties, etc.)
   - The final score calculation formulas
   - The status/recommendation thresholds

2. A summary document explaining:
   - The two scoring dimensions (WHO and WHEN)
   - All the special scoring logic
   - What triggers each recommendation

Format the JSON cleanly with comments.
```

---

## What to Send Ivan

1. The JSON export
2. A link to the Canvas artifact so Ivan can test it himself
3. Optionally: 2-3 example candidate profiles with expected scores, so Ivan can verify his implementation matches yours

---

Questions? Let me know.
