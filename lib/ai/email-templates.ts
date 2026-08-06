export interface WaveAiEmailTemplate {
  id: string
  name: string
  description: string
  instruction: string
}

export const WAVE_AI_EMAIL_TEMPLATES: WaveAiEmailTemplate[] = [
  {
    id: "general",
    name: "General message",
    description: "A clear, professional email for a staff-defined purpose.",
    instruction: "Follow the staff goal closely and keep the email concise.",
  },
  {
    id: "welcome",
    name: "Welcome",
    description: "Welcome a repreneur and make the immediate next step clear.",
    instruction: "Welcome the repreneur warmly and state one concrete next step without promising an outcome.",
  },
  {
    id: "follow-up",
    name: "Follow-up",
    description: "Reconnect after inactivity or an incomplete step.",
    instruction: "Write a respectful follow-up that names the recorded stage and asks for one simple next action.",
  },
  {
    id: "offer-received",
    name: "Offer received",
    description: "Acknowledge an offer or service proposal and explain what follows.",
    instruction: "Acknowledge the offer-related step and explain only the next recorded workflow action.",
  },
  {
    id: "milestone-completed",
    name: "Milestone completed",
    description: "Recognize progress and explain the next stage.",
    instruction: "Recognize the completed step without exaggeration and state the next recorded stage.",
  },
  {
    id: "rejection",
    name: "Polite decline",
    description: "Communicate a decision respectfully and without invented reasons.",
    instruction: "Communicate the decision with care. Do not invent reasons, alternatives or future promises.",
  },
]

export function getWaveAiEmailTemplate(templateId: string) {
  return WAVE_AI_EMAIL_TEMPLATES.find((template) => template.id === templateId) ?? null
}

