-- Setup Supabase Storage for Avatar Uploads
-- Run these steps in order

-- ============================================
-- STEP 1: Create the storage bucket (via Dashboard)
-- ============================================
-- Go to Supabase Dashboard > Storage > New bucket
-- Name: avatars
-- Public bucket: YES (check the box)
-- Click "Create bucket"

-- ============================================
-- STEP 2: Run these RLS policies in SQL Editor
-- ============================================

-- Allow authenticated users to upload avatars
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to update/replace their avatars
CREATE POLICY "Authenticated users can update avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- Allow anyone to view avatars (public read)
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Allow authenticated users to delete avatars
CREATE POLICY "Authenticated users can delete avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
