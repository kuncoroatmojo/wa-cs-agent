-- Production Migration: Add WhatsApp target instance to profiles
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Add the whatsapp_target_instance column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS whatsapp_target_instance TEXT;

-- 2. Add comment for documentation
COMMENT ON COLUMN profiles.whatsapp_target_instance IS 'WhatsApp Evolution API target instance for this user';

-- 3. Update the specific user with target instance 'istn'
UPDATE profiles 
SET whatsapp_target_instance = 'istn' 
WHERE email = 'kuncoro.atmojo@gmail.com';

-- 4. Verify the update
SELECT id, email, whatsapp_target_instance 
FROM profiles 
WHERE email = 'kuncoro.atmojo@gmail.com'; 