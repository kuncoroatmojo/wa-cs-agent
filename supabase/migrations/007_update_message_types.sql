-- Migration: Update message_type constraint to support all Evolution API message types
-- This migration adds support for all WhatsApp message types returned by Evolution API

-- Drop the existing constraint
ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_message_type_check;

-- Add the new constraint with all Evolution API message types
ALTER TABLE conversation_messages ADD CONSTRAINT conversation_messages_message_type_check 
CHECK (message_type IN (
  -- Original supported types
  'text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'sticker', 'reaction',
  
  -- Evolution API specific message types
  'audioMessage', 'buttonsMessage', 'buttonsResponseMessage', 'commentMessage', 
  'contactMessage', 'contactsArrayMessage', 'conversation', 'documentMessage', 
  'documentWithCaptionMessage', 'editedMessage', 'extendedTextMessage', 
  'groupInviteMessage', 'imageMessage', 'interactiveMessage', 'locationMessage', 
  'pollCreationMessageV2', 'pollCreationMessageV3', 'productMessage', 
  'protocolMessage', 'ptvMessage', 'stickerMessage', 'templateMessage', 
  'videoMessage', 'viewOnceMessageV2'
));

-- Update the evolutionMessageSync service to map Evolution API types to our standardized types
-- Note: This will be handled in the application code to normalize message types for better RAG processing 