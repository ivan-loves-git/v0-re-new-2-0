/**
 * Wavy System - Communication Router
 *
 * Routes messages to the appropriate communication system:
 * - INTERNAL (team) → Wavy 🌊 (witty, self-aware AI personality)
 * - EXTERNAL (repreneurs) → Re-New Assistant (professional, warm)
 *
 * This file serves as the main entry point and maintains backwards compatibility.
 */

import {
  getWavyInternalPrompt,
  getWavyInternalTemplateContext,
  isInternalTemplate,
  WAVY_INTERNAL_TEMPLATES
} from './wavy-internal'

import {
  getRenewAssistantPrompt,
  getRenewAssistantTemplateContext,
  isExternalTemplate,
  RENEW_ASSISTANT_TEMPLATES
} from './renew-assistant'

// Re-export for backwards compatibility
export { WAVY_INTERNAL_TEMPLATES } from './wavy-internal'
export { RENEW_ASSISTANT_TEMPLATES } from './renew-assistant'

// Combined templates list for UI
export const BUILT_IN_TEMPLATES = [
  ...WAVY_INTERNAL_TEMPLATES,
  ...RENEW_ASSISTANT_TEMPLATES
]

/**
 * Determines if a template is for internal or external communication
 */
export function getTemplateAudience(templateId: string): 'internal' | 'external' {
  if (isInternalTemplate(templateId)) return 'internal'
  if (isExternalTemplate(templateId)) return 'external'
  // Default to external for unknown templates (safer/more professional)
  return 'external'
}

/**
 * Gets the appropriate system prompt based on template audience
 */
export function getWavySystemPrompt(channel: 'email' | 'whatsapp', templateId?: string): string {
  const audience = templateId ? getTemplateAudience(templateId) : 'external'

  if (audience === 'internal') {
    return getWavyInternalPrompt(channel)
  }
  return getRenewAssistantPrompt(channel)
}

/**
 * Gets template context based on audience
 */
export function getTemplateContext(templateId: string): string {
  const audience = getTemplateAudience(templateId)

  if (audience === 'internal') {
    return getWavyInternalTemplateContext(templateId)
  }
  return getRenewAssistantTemplateContext(templateId)
}

/**
 * Check if a template is internal (for UI labeling)
 */
export function isInternal(templateId: string): boolean {
  return isInternalTemplate(templateId)
}

/**
 * Check if a template is external (for UI labeling)
 */
export function isExternal(templateId: string): boolean {
  return isExternalTemplate(templateId)
}
