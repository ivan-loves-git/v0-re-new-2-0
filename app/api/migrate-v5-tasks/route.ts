import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// V5 Launch Plan Tasks
const V5_TASKS = [
  // Stream: questionnaire (Week 1 - Due Jan 22-24)
  {
    title: "Deliver final questionnaire spec (Notion)",
    description: "Complete the questionnaire specification in Notion with all questions, options, and scoring weights",
    owner_name: "Bertrand + Amelie",
    status: "pending",
    expected_end_date: "2026-01-22",
    stream: "questionnaire",
  },
  {
    title: "Validate scoring weights",
    description: "Review and confirm the Tier 1 scoring weights for each questionnaire question",
    owner_name: "Bertrand + Amelie",
    status: "pending",
    expected_end_date: "2026-01-22",
    stream: "questionnaire",
  },
  {
    title: "LDC handling decision (conditional upload)",
    description: "Decide how to handle Lettre de Cadrage - make upload conditional based on journey stage",
    owner_name: "Bertrand + Amelie",
    status: "pending",
    expected_end_date: "2026-01-22",
    stream: "questionnaire",
  },
  {
    title: "Confirm journey stage names",
    description: "Finalize the names for each journey stage (Explorer, Learner, Ready, Serial Acquirer)",
    owner_name: "Bertrand",
    status: "pending",
    expected_end_date: "2026-01-24",
    stream: "questionnaire",
  },

  // Stream: email (Week 2 - Due Jan 31)
  {
    title: "Draft welcome email template",
    description: "Create the welcome email template sent after intake form submission",
    owner_name: "Bertrand + Amelie",
    status: "pending",
    expected_end_date: "2026-01-31",
    stream: "email",
  },
  {
    title: "Draft qualification email",
    description: "Create the email template sent when a lead is qualified (Tier 2 stars assigned)",
    owner_name: "Bertrand + Amelie",
    status: "pending",
    expected_end_date: "2026-01-31",
    stream: "email",
  },
  {
    title: "Draft interview invitation email",
    description: "Create the email template inviting qualified repreneurs to an interview",
    owner_name: "Bertrand + Amelie",
    status: "pending",
    expected_end_date: "2026-01-31",
    stream: "email",
  },
  {
    title: "Draft offer proposal email",
    description: "Create the email template for sending offer proposals to clients",
    owner_name: "Bertrand + Amelie",
    status: "pending",
    expected_end_date: "2026-01-31",
    stream: "email",
  },
  {
    title: "Draft follow-up reminder email",
    description: "Create the email template for follow-up reminders to inactive leads",
    owner_name: "Bertrand + Amelie",
    status: "pending",
    expected_end_date: "2026-01-31",
    stream: "email",
  },

  // Stream: domain (Week 2 - Due Jan 27-31)
  {
    title: "Provide DNS access for app.re-new.team",
    description: "Grant DNS access to configure the custom domain for the platform",
    owner_name: "Bertrand",
    status: "pending",
    expected_end_date: "2026-01-27",
    stream: "domain",
  },
  {
    title: "Export Flatchr CSV",
    description: "Export all repreneur data from Flatchr in CSV format for import",
    owner_name: "Bertrand",
    status: "pending",
    expected_end_date: "2026-01-31",
    stream: "domain",
  },

  // Stream: implementation (Week 2 - Ivan)
  {
    title: "Implement questionnaire from Notion spec",
    description: "Build the questionnaire based on the final Notion specification",
    owner_name: "Ivan",
    status: "pending",
    expected_end_date: "2026-01-29",
    stream: "implementation",
  },
  {
    title: "Configure app.re-new.team domain",
    description: "Set up the custom domain in Vercel and configure DNS",
    owner_name: "Ivan",
    status: "pending",
    expected_end_date: "2026-01-31",
    stream: "implementation",
  },
  {
    title: "Implement welcome email automation",
    description: "Connect welcome email template to intake form submission trigger",
    owner_name: "Ivan",
    status: "pending",
    expected_end_date: "2026-01-31",
    stream: "implementation",
  },

  // Stream: testing (Week 3 - Feb 3-7)
  {
    title: "Import Flatchr historical data",
    description: "Import the Flatchr CSV export into the Re-New platform",
    owner_name: "Ivan",
    status: "pending",
    expected_end_date: "2026-02-03",
    stream: "testing",
  },
  {
    title: "Test intake form usability",
    description: "Complete user testing of the public intake form flow",
    owner_name: "Bertrand + Amelie",
    status: "pending",
    expected_end_date: "2026-02-05",
    stream: "testing",
  },
  {
    title: "Verify email automation",
    description: "Test all email templates are sent correctly at the right triggers",
    owner_name: "Ivan",
    status: "pending",
    expected_end_date: "2026-02-05",
    stream: "testing",
  },
  {
    title: "Review journey stages",
    description: "Validate the journey stage progression works as expected",
    owner_name: "All",
    status: "pending",
    expected_end_date: "2026-02-06",
    stream: "testing",
  },
  {
    title: "Validate notes/activity features",
    description: "Test notes and activity tracking functionality",
    owner_name: "All",
    status: "pending",
    expected_end_date: "2026-02-06",
    stream: "testing",
  },
  {
    title: "Fix all reported issues",
    description: "Resolve all bugs and issues found during testing",
    owner_name: "Ivan",
    status: "pending",
    expected_end_date: "2026-02-07",
    stream: "testing",
  },

  // Stream: launch (Feb 7-10)
  {
    title: "Final sign-off from Bertrand",
    description: "Get final approval from Bertrand before go-live",
    owner_name: "Bertrand",
    status: "pending",
    expected_end_date: "2026-02-07",
    stream: "launch",
  },
  {
    title: "GO-LIVE: Public intake form",
    description: "Launch the public intake form and begin accepting new repreneurs",
    owner_name: "All",
    status: "pending",
    expected_end_date: "2026-02-10",
    stream: "launch",
  },
]

export async function POST() {
  try {
    const supabase = createAdminClient()

    // Step 1: Update the stream CHECK constraint
    // Note: This requires direct SQL execution which Supabase JS doesn't support directly
    // The constraint will be updated via the SQL migration script instead

    // Step 2: Delete all existing tasks
    const { error: deleteError } = await supabase.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000")

    if (deleteError) {
      return NextResponse.json({ error: `Failed to delete existing tasks: ${deleteError.message}` }, { status: 500 })
    }

    // Step 3: Insert all V5 tasks
    const { data: insertedTasks, error: insertError } = await supabase
      .from("tasks")
      .insert(V5_TASKS)
      .select()

    if (insertError) {
      // Check if it's a constraint violation
      if (insertError.message.includes("tasks_stream_check")) {
        return NextResponse.json(
          {
            error: "Database constraint needs updating",
            message: "The tasks table still has the old stream constraint. Run this SQL in Supabase SQL Editor first:",
            sql: `
-- Update stream CHECK constraint for V5 streams
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_stream_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_stream_check
  CHECK (stream IN ('questionnaire', 'email', 'domain', 'implementation', 'testing', 'launch'));
            `.trim(),
            thenRetry: "After running the SQL, POST to this endpoint again",
          },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: `Failed to insert V5 tasks: ${insertError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully migrated to V5 tasks`,
      tasksCreated: insertedTasks?.length || 0,
      tasksByStream: {
        questionnaire: V5_TASKS.filter((t) => t.stream === "questionnaire").length,
        email: V5_TASKS.filter((t) => t.stream === "email").length,
        domain: V5_TASKS.filter((t) => t.stream === "domain").length,
        implementation: V5_TASKS.filter((t) => t.stream === "implementation").length,
        testing: V5_TASKS.filter((t) => t.stream === "testing").length,
        launch: V5_TASKS.filter((t) => t.stream === "launch").length,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: `Migration failed: ${error}` }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "V5 Launch Tasks Migration API",
    usage: "POST to /api/migrate-v5-tasks to run the migration",
    warning: "This will DELETE all existing tasks and create new V5 tasks",
    tasksToCreate: V5_TASKS.length,
    prerequisite: "Run this SQL in Supabase SQL Editor first:",
    sql: `
-- Update stream CHECK constraint for V5 streams
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_stream_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_stream_check
  CHECK (stream IN ('questionnaire', 'email', 'domain', 'implementation', 'testing', 'launch'));
    `.trim(),
  })
}
