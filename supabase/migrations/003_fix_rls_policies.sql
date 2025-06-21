-- Migration to fix RLS policies for whatsapp_instances table
-- This addresses the "new row violates row-level security policy" error

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Users can create instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Users can update own instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Users can delete own instances" ON whatsapp_instances;

-- Create more permissive RLS policies for whatsapp_instances
-- These policies check that the user is authenticated and matches the user_id

-- Policy for SELECT (viewing instances)
CREATE POLICY "Enable read access for authenticated users" ON whatsapp_instances
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        auth.uid() = user_id
    );

-- Policy for INSERT (creating instances)
CREATE POLICY "Enable insert for authenticated users" ON whatsapp_instances
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        auth.uid() = user_id
    );

-- Policy for UPDATE (updating instances)
CREATE POLICY "Enable update for authenticated users" ON whatsapp_instances
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND 
        auth.uid() = user_id
    ) WITH CHECK (
        auth.role() = 'authenticated' AND 
        auth.uid() = user_id
    );

-- Policy for DELETE (deleting instances)
CREATE POLICY "Enable delete for authenticated users" ON whatsapp_instances
    FOR DELETE USING (
        auth.role() = 'authenticated' AND 
        auth.uid() = user_id
    );

-- Ensure RLS is enabled
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_instances TO authenticated;
GRANT USAGE ON SEQUENCE whatsapp_instances_id_seq TO authenticated;

-- Add a comment for documentation
COMMENT ON TABLE whatsapp_instances IS 'WhatsApp instances for each user with proper RLS policies'; 