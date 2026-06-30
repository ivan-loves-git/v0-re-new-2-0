import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getCurrentUser } from "@/lib/auth-server"
import { getWavySystemPrompt, getTemplateContext, BUILT_IN_TEMPLATES, getTemplateAudience } from "@/lib/prompts/wavy-system"
import { createAdminClient } from "@/lib/supabase/admin"
import { env } from "@/lib/env"

interface GenerateRequest {
  channel: "email" | "whatsapp"
  templateId: string
  repreneurId?: string
  repreneurData?: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    whoScore?: number
    whenScore?: number
    journeyStage?: string
    lastActivityDate?: string
  }
  customInstructions?: string
}

export async function POST(request: Request) {
  // Check authentication
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check API key
  if (!env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Anthropic API key not configured" },
      { status: 500 }
    )
  }

  const anthropic = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  })

  try {
    const requestBody: GenerateRequest = await request.json()
    const { channel, templateId, repreneurId, repreneurData, customInstructions } = requestBody

    // Validate channel
    if (!channel || !["email", "whatsapp"].includes(channel)) {
      return NextResponse.json(
        { error: "Invalid channel. Must be 'email' or 'whatsapp'" },
        { status: 400 }
      )
    }

    // Get template context (built-in or custom)
    let templateContext = ""
    const builtInTemplate = BUILT_IN_TEMPLATES.find(t => t.id === templateId)

    if (builtInTemplate) {
      templateContext = getTemplateContext(templateId)
    } else {
      // Look up custom template from database
      const supabase = createAdminClient()
      const { data: customTemplate } = await supabase
        .from("wavy_templates")
        .select("name, description")
        .eq("id", templateId)
        .single()

      if (customTemplate) {
        templateContext = `

## Template Context: ${customTemplate.name}
${customTemplate.description}

Adjust your tone and content to fit this template's purpose.`
      }
    }

    // Build the repreneur context
    let repreneurContext = ""
    if (repreneurData) {
      repreneurContext = `

## Repreneur Information
- Name: ${repreneurData.firstName} ${repreneurData.lastName}
- Email: ${repreneurData.email}
${repreneurData.phone ? `- Phone: ${repreneurData.phone}` : ""}
${repreneurData.whoScore ? `- WHO Score (Profile): ${repreneurData.whoScore}/100` : ""}
${repreneurData.whenScore ? `- WHEN Score (Readiness): ${repreneurData.whenScore}/100` : ""}
${repreneurData.journeyStage ? `- Current Stage: ${repreneurData.journeyStage}` : ""}
${repreneurData.lastActivityDate ? `- Last Activity: ${repreneurData.lastActivityDate}` : ""}`
    } else if (repreneurId) {
      // Fetch repreneur data from database
      const supabase = createAdminClient()
      const { data: repreneur } = await supabase
        .from("repreneurs")
        .select("first_name, last_name, email, phone, tier1_score, who_score, when_score, journey_stage")
        .eq("id", repreneurId)
        .single()

      if (repreneur) {
        // Use who_score if available, fallback to tier1_score for legacy data
        const whoScore = repreneur.who_score ?? repreneur.tier1_score
        repreneurContext = `

## Repreneur Information
- Name: ${repreneur.first_name} ${repreneur.last_name}
- Email: ${repreneur.email}
${repreneur.phone ? `- Phone: ${repreneur.phone}` : ""}
${whoScore ? `- WHO Score (Profile): ${whoScore}/100` : ""}
${repreneur.when_score ? `- WHEN Score (Readiness): ${repreneur.when_score}/100` : ""}
${repreneur.journey_stage ? `- Current Stage: ${repreneur.journey_stage}` : ""}`
      }
    }

    // Determine audience for logging/debugging
    const audience = getTemplateAudience(templateId)

    // Build the full system prompt (routes to Wavy or Re-New Assistant based on template)
    const systemPrompt = getWavySystemPrompt(channel, templateId) + templateContext + repreneurContext

    // Build the user prompt with explicit format instructions
    let userPrompt = channel === "email"
      ? `Write an email for this repreneur.

OUTPUT FORMAT (follow exactly):
Subject: [Write a clear, professional subject line - no emoji in subject]

[Email body starts here - greeting first, then content, then sign-off]

IMPORTANT:
- Start the body with a greeting (e.g., "Hi [FirstName],")
- Do NOT include "Subject:" anywhere in the email body
- Use plain text only - no markdown, no asterisks for emphasis
- End with your signature block`
      : `Write a WhatsApp message for this repreneur.

IMPORTANT:
- Keep it to 2-4 sentences max
- Conversational tone, like texting a colleague
- One emoji maximum (usually 🌊)
- No formal greeting or signature
- Direct and actionable`

    if (customInstructions) {
      userPrompt += `\n\nSPECIFIC GOAL: ${customInstructions}`
    } else if (templateContext) {
      userPrompt += `\n\nWrite the message based on the template context provided in the system prompt.`
    }

    // Call Claude Sonnet
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    })

    // Extract the response text
    const responseText = message.content[0].type === "text"
      ? message.content[0].text
      : ""

    // For emails, try to extract subject line
    let subject = ""
    let messageBody = responseText

    if (channel === "email") {
      // Try to parse subject if Claude included it
      const subjectMatch = responseText.match(/^Subject:\s*(.+?)(?:\n|$)/i)
      if (subjectMatch) {
        subject = subjectMatch[1].trim()
        messageBody = responseText.replace(/^Subject:\s*.+?\n+/i, "").trim()
      } else {
        // Generate a default subject based on template
        const templateName = builtInTemplate?.name || "Update"
        subject = `Re-New: ${templateName}`
      }
    }

    // Validate output quality - collect warnings for UI
    const warnings: string[] = []

    // Get first name for personalization check
    const firstName = repreneurData?.firstName || ""

    if (channel === "email") {
      // Check subject quality
      if (!subject || subject.length < 5) {
        warnings.push("Subject line is missing or too short")
      }

      // Check for markdown formatting (forbidden)
      if (messageBody.includes("**") || messageBody.includes("*") && messageBody.match(/\*[^*]+\*/)) {
        warnings.push("Message contains markdown formatting (asterisks)")
      }

      // Check body length
      if (messageBody.length < 100) {
        warnings.push("Email body seems too short")
      }

      // Check personalization (only if we have a name)
      if (firstName && !messageBody.toLowerCase().includes(firstName.toLowerCase())) {
        warnings.push("Message doesn't include the repreneur's first name")
      }

      // Check if subject accidentally ended up in body
      if (messageBody.toLowerCase().startsWith("subject:")) {
        warnings.push("Subject line appears in email body")
      }
    } else {
      // WhatsApp validations
      if (messageBody.length > 500) {
        warnings.push("WhatsApp message is too long (should be 2-4 sentences)")
      }

      // Check for markdown
      if (messageBody.includes("**") || (messageBody.includes("*") && messageBody.match(/\*[^*]+\*/))) {
        warnings.push("Message contains markdown formatting")
      }
    }

    return NextResponse.json({
      subject,
      body: messageBody,
      channel,
      templateId,
      audience, // 'internal' (Wavy) or 'external' (Re-New Assistant)
      warnings: warnings.length > 0 ? warnings : undefined,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    })
  } catch (error) {
    console.error("Error generating message:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate message" },
      { status: 500 }
    )
  }
}
