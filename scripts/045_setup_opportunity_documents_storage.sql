-- Migration: Setup opportunity documents storage bucket
-- Purpose: Store teasers, deal books, NDA files, and external analysis PDFs
-- linked to opportunities.
-- V2 boundary: storage and metadata only. No inline PDF viewer, automatic parser,
-- AI analysis, or public unauthenticated access is introduced here.

INSERT INTO storage.buckets (id, name, public)
VALUES ('opportunity-documents', 'opportunity-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can view opportunity documents" ON storage.objects;
CREATE POLICY "Authenticated users can view opportunity documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'opportunity-documents'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated users can upload opportunity documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload opportunity documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'opportunity-documents'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated users can update opportunity documents" ON storage.objects;
CREATE POLICY "Authenticated users can update opportunity documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'opportunity-documents'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Authenticated users can delete opportunity documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete opportunity documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'opportunity-documents'
  AND auth.role() = 'authenticated'
);

COMMENT ON POLICY "Authenticated users can view opportunity documents" ON storage.objects IS
  'Opportunity documents are staff-only by default. Repreneur visibility is controlled by opportunity_documents metadata, not public storage.';
