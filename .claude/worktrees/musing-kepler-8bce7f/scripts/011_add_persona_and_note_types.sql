-- Migration 011: Add persona field and note types
-- Adds persona for candidate profiling and note_type for activity categorization

-- Add persona column to repreneurs
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS persona TEXT;

-- Add note_type column to notes table (call, email, meeting, other)
ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS note_type TEXT DEFAULT 'other';

-- Add comments
COMMENT ON COLUMN public.repreneurs.persona IS 'Candidate acquisition style: first_time_buyer, serial_acquirer, corporate_spinoff, family_succession';
COMMENT ON COLUMN public.notes.note_type IS 'Type of interaction: call, email, meeting, other';
