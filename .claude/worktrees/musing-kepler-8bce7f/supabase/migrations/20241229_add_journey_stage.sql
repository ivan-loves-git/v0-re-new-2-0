-- Add journey_stage column to repreneurs table
-- This tracks the repreneur's maturity in their acquisition readiness journey
-- Values: explorer, learner, ready, serial_acquirer

ALTER TABLE repreneurs
ADD COLUMN IF NOT EXISTS journey_stage TEXT
CHECK (journey_stage IN ('explorer', 'learner', 'ready', 'serial_acquirer'))
DEFAULT 'explorer';

-- Add comment for documentation
COMMENT ON COLUMN repreneurs.journey_stage IS 'Repreneurship maturity stage: explorer (curious), learner (building skills), ready (can write LOIs), serial_acquirer (experienced buyer)';
