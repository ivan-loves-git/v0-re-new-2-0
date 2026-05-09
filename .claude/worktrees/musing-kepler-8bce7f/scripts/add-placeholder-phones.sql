-- Add placeholder phone numbers to all Flatchr-imported repreneurs
-- These need to be replaced with real phone numbers

UPDATE repreneurs
SET phone = '+33 12345678'
WHERE source = 'flatchr_import'
  AND (phone IS NULL OR phone = '');
