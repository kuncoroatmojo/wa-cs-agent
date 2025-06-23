-- First, get a list of instance_keys that have conversations
WITH instance_keys AS (
  SELECT DISTINCT instance_key 
  FROM conversations 
  WHERE instance_key IS NOT NULL
)
-- Delete messages for these instances
DELETE FROM messages 
WHERE instance_key IN (SELECT instance_key FROM instance_keys);

-- Then delete the conversations
DELETE FROM conversations 
WHERE instance_key IN (SELECT instance_key FROM instance_keys);
