-- Migration: Add 'evolution_api' to connection_type check constraint
-- This allows Evolution API instances to be stored in the database

-- Drop the existing check constraint
ALTER TABLE whatsapp_instances 
DROP CONSTRAINT IF EXISTS whatsapp_instances_connection_type_check;

-- Add the new check constraint that includes 'evolution_api'
ALTER TABLE whatsapp_instances 
ADD CONSTRAINT whatsapp_instances_connection_type_check 
CHECK (connection_type IN ('baileys', 'cloud_api', 'evolution_api'));

-- Update any existing records that might have invalid connection_type values
-- (This is a safety measure in case there are any orphaned records)
UPDATE whatsapp_instances 
SET connection_type = 'evolution_api' 
WHERE connection_type NOT IN ('baileys', 'cloud_api', 'evolution_api'); 