-- Migration to fix RLS policies for profiles table
-- This addresses the "new row violates row-level security policy" error for profiles

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON profiles;

-- Create RLS policies for profiles table
-- These policies check that the user is authenticated and matches the profile id

-- Policy for SELECT (viewing profile)
CREATE POLICY "Enable read access for authenticated users" ON profiles
    FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        auth.uid() = id
    );

-- Policy for INSERT (creating profile)
CREATE POLICY "Enable insert for authenticated users" ON profiles
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        auth.uid() = id
    );

-- Policy for UPDATE (updating profile)
CREATE POLICY "Enable update for authenticated users" ON profiles
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND 
        auth.uid() = id
    ) WITH CHECK (
        auth.role() = 'authenticated' AND 
        auth.uid() = id
    );

-- Policy for DELETE (deleting profile)
CREATE POLICY "Enable delete for authenticated users" ON profiles
    FOR DELETE USING (
        auth.role() = 'authenticated' AND 
        auth.uid() = id
    );

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;

-- Add a comment for documentation
COMMENT ON TABLE profiles IS 'User profiles with proper RLS policies allowing users to manage their own profile'; 