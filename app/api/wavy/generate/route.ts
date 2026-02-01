import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getCurrentUser } from "@/lib/auth-server"
import { getWavySystemPrompt, getTemplateContext, BUILT_IN_TEMPLATES } from "@/lib/prompts/wavy-system"
import { createAdminClient } from "@/lib/supabase/admin"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Anthropic API key not configured" },
      { status: 500 }
    )
  }

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

    // Build the full system prompt
    const systemPrompt = getWavySystemPrompt(channel) + templateContext + repreneurContext

    // Build the user prompt
    let userPrompt = channel === "email"
      ? "Write an email for this repreneur."
      : "Write a WhatsApp message for this repreneur."

    if (customInstructions) {
      userPrompt += `\n\nAdditional instructions: ${customInstructions}`
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
        subject = `Re-New: ${templateName} 🌊`
      }
    }

    return NextResponse.json({
      subject,
      body: messageBody,
      channel,
      templateId,
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
