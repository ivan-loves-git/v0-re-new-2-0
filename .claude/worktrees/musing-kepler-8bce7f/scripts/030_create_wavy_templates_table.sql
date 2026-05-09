-- Migration: 030_create_wavy_templates_table.sql
-- Description: Create table for custom Wavy message templates
-- Date: 2026-02-01

-- Custom templates for Wavy writing assistant
CREATE TABLE IF NOT EXISTS wavy_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,  -- "When to use this template" - Claude infers tone from this
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'whatsapp')),
  created_by TEXT,  -- User email who created it
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by channel
CREATE INDEX IF NOT EXISTS idx_wavy_templates_channel ON wavy_templates(channel);

-- Comment on table
COMMENT ON TABLE wavy_templates IS 'Custom templates for Wavy writing assistant. Built-in templates are defined in code.';
COMMENT ON COLUMN wavy_templates.description IS 'Description of when to use this template. Claude uses this to infer appropriate tone and content.';
