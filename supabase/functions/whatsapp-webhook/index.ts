import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WhatsAppMessage {
  from: string;
  body: string;
  timestamp: string;
  messageId: string;
  type: 'text' | 'image' | 'document' | 'audio';
  mediaUrl?: string;
}

interface WhatsAppWebhookPayload {
  instanceKey: string;
  message: WhatsAppMessage;
  metadata?: Record<string, any>;
}

interface EvolutionWebhookEvent {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
      [key: string]: any;
    };
    messageType: string;
    messageTimestamp: number;
    status?: string;
    [key: string]: any;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Use service role key for webhook processing (bypasses RLS for webhook events)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const webhookEvent: EvolutionWebhookEvent = await req.json()
    console.log('📨 Received Evolution API webhook:', JSON.stringify(webhookEvent, null, 2))

    // Process different event types
    switch (webhookEvent.event) {
      case 'APPLICATION_STARTUP':
        await handleApplicationStartup(supabase, webhookEvent)
        break
      case 'QRCODE_UPDATED':
        await handleQRCodeUpdated(supabase, webhookEvent)
        break
      case 'MESSAGES_SET':
        await handleMessagesSet(supabase, webhookEvent)
        break
      case 'MESSAGES_UPSERT':
      case 'messages.upsert':
        await handleMessageUpsert(supabase, webhookEvent)
        break
      case 'MESSAGES_UPDATE':
      case 'messages.update':
        await handleMessageUpdate(supabase, webhookEvent)
        break
      case 'MESSAGES_DELETE':
        await handleMessageDelete(supabase, webhookEvent)
        break
      case 'SEND_MESSAGE':
        await handleSendMessage(supabase, webhookEvent)
        break
      case 'CONTACTS_SET':
        await handleContactsSet(supabase, webhookEvent)
        break
      case 'CONTACTS_UPSERT':
      case 'contacts.update':
        await handleContactsUpdate(supabase, webhookEvent)
        break
      case 'CONTACTS_UPDATE':
        await handleContactsUpdate(supabase, webhookEvent)
        break
      case 'PRESENCE_UPDATE':
      case 'presence.update':
        await handlePresenceUpdate(supabase, webhookEvent)
        break
      case 'CHATS_SET':
        await handleChatsSet(supabase, webhookEvent)
        break
      case 'CHATS_UPSERT':
      case 'chats.upsert':
        await handleChatsUpsert(supabase, webhookEvent)
        break
      case 'CHATS_UPDATE':
      case 'chats.update':
        await handleChatsUpdate(supabase, webhookEvent)
        break
      case 'CHATS_DELETE':
        await handleChatsDelete(supabase, webhookEvent)
        break
      case 'GROUPS_UPSERT':
        await handleGroupsUpsert(supabase, webhookEvent)
        break
      case 'GROUP_UPDATE':
        await handleGroupUpdate(supabase, webhookEvent)
        break
      case 'GROUP_PARTICIPANTS_UPDATE':
        await handleGroupParticipantsUpdate(supabase, webhookEvent)
        break
      case 'CONNECTION_UPDATE':
      case 'connection.update':
        await handleConnectionUpdate(supabase, webhookEvent)
        break
      case 'CALL':
        await handleCall(supabase, webhookEvent)
        break
      case 'NEW_JWT_TOKEN':
        await handleNewJwtToken(supabase, webhookEvent)
        break
      case 'LOGOUT_INSTANCE':
        await handleLogoutInstance(supabase, webhookEvent)
        break
      case 'REMOVE_INSTANCE':
        await handleRemoveInstance(supabase, webhookEvent)
        break
      case 'LABELS_ASSOCIATION':
        await handleLabelsAssociation(supabase, webhookEvent)
        break
      default:
        console.log(`⚠️ Unhandled webhook event type: ${webhookEvent.event}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error processing webhook:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleMessageUpsert(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    const { key, pushName, message, messageType, messageTimestamp } = data

    console.log('💬 Processing message upsert for instance:', instance)

    // Find the WhatsApp instance in our database
    const { data: whatsappInstance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, user_id, instance_key')
      .eq('instance_key', instance)
      .single()

    if (instanceError || !whatsappInstance) {
      console.error('❌ WhatsApp instance not found:', instance)
      return
    }

    // Extract contact information
    const contactId = key.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')
    const isGroup = key.remoteJid.includes('@g.us')
    
    // Determine contact name with fallbacks
    let contactName = contactId
    if (isGroup) {
      // For groups, try to get the group name from the chat data
      contactName = data.groupMetadata?.subject || `Group ${contactId}`
    } else {
      // For individual chats, use pushName with fallbacks
      contactName = pushName || data.verifiedName || data.notifyName || contactId
    }

    // Check for existing conversation using external_conversation_id and instance_key first
    const { data: existingConversations } = await supabase
      .from('conversations')
      .select('*')
      .eq('external_conversation_id', key.remoteJid)
      .eq('instance_key', instance)
      .limit(1);

    let conversation;
    let convError;

    if (existingConversations && existingConversations.length > 0) {
      // Update existing conversation
      const existingConv = existingConversations[0];
      const updateResult = await supabase
        .from('conversations')
        .update({
          contact_name: contactName,
          contact_metadata: {
            isGroup,
            remoteJid: key.remoteJid,
            pushName,
            verifiedName: data.verifiedName,
            notifyName: data.notifyName
          },
          status: 'active',
          last_synced_at: new Date().toISOString(),
          sync_status: 'synced',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConv.id)
        .select()
        .single();
      
      conversation = updateResult.data;
      convError = updateResult.error;
      console.log('✅ Updated existing conversation:', conversation?.id);
    } else {
      // Create new conversation
      const createResult = await supabase
        .from('conversations')
        .insert({
          user_id: whatsappInstance.user_id,
          integration_type: 'whatsapp',
          integration_id: whatsappInstance.id,
          instance_key: instance,
          contact_id: contactId,
          contact_name: contactName,
          contact_metadata: {
            isGroup,
            remoteJid: key.remoteJid,
            pushName,
            verifiedName: data.verifiedName,
            notifyName: data.notifyName
          },
          external_conversation_id: key.remoteJid,
          status: 'active',
          last_synced_at: new Date().toISOString(),
          sync_status: 'synced'
        })
        .select()
        .single();
      
      conversation = createResult.data;
      convError = createResult.error;
      console.log('✅ Created new conversation:', conversation?.id);
    }

    if (convError) {
      console.error('❌ Error upserting conversation:', convError)
      return
    }

    console.log('✅ Conversation upserted:', conversation.id)

    // Extract message content
    let messageContent = '[Media]'
    if (message?.conversation) {
      messageContent = message.conversation
    } else if (message?.extendedTextMessage?.text) {
      messageContent = message.extendedTextMessage.text
    } else if (message?.imageMessage?.caption) {
      messageContent = message.imageMessage.caption
    } else if (message?.videoMessage?.caption) {
      messageContent = message.videoMessage.caption
    }

    // Map message type
    let unifiedMessageType = 'text'
    if (messageType.includes('image')) unifiedMessageType = 'image'
    else if (messageType.includes('audio')) unifiedMessageType = 'audio'
    else if (messageType.includes('video')) unifiedMessageType = 'video'
    else if (messageType.includes('document')) unifiedMessageType = 'document'
    else if (messageType.includes('location')) unifiedMessageType = 'location'
    else if (messageType.includes('contact')) unifiedMessageType = 'contact'
    else if (messageType.includes('sticker')) unifiedMessageType = 'sticker'

    // Insert message
    const { error: messageError } = await supabase
      .from('conversation_messages')
      .upsert({
        conversation_id: conversation.id,
        content: messageContent,
        message_type: unifiedMessageType,
        direction: key.fromMe ? 'outbound' : 'inbound',
        sender_type: key.fromMe ? 'agent' : 'contact', // Changed from 'bot' to 'agent' for consistency
        sender_name: pushName,
        sender_id: key.fromMe ? instance : key.remoteJid,
        status: 'delivered',
        external_message_id: key.id,
        external_timestamp: new Date(messageTimestamp * 1000).toISOString(),
        external_metadata: data
      }, {
        onConflict: 'external_message_id'
      })

    if (messageError) {
      console.error('❌ Error inserting message:', messageError)
      return
    }

    // Update conversation with latest message preview (consistent with sync service)
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date(messageTimestamp * 1000).toISOString(),
        last_message_preview: messageContent.substring(0, 100),
        last_message_from: key.fromMe ? 'agent' : 'contact',
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation.id)

    console.log('✅ Message processed and conversation preview updated')

    // Create sync event for tracking
    await supabase
      .from('conversation_sync_events')
      .insert({
        user_id: whatsappInstance.user_id,
        integration_type: 'whatsapp',
        integration_id: whatsappInstance.id,
        event_type: 'message_received',
        event_data: event,
        processed: true,
        processed_at: new Date().toISOString()
      })

  } catch (error) {
    console.error('❌ Error in handleMessageUpsert:', error)
    throw error
  }
}

async function handleMessageUpdate(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { data } = event
    const { key, status } = data

    console.log('📝 Processing message update:', key.id, 'status:', status)

    // Update message status if it exists
    const { error } = await supabase
      .from('conversation_messages')
      .update({
        status: mapMessageStatus(status),
        updated_at: new Date().toISOString()
      })
      .eq('external_message_id', key.id)

    if (error) {
      console.error('❌ Error updating message status:', error)
    } else {
      console.log('✅ Message status updated')
    }

  } catch (error) {
    console.error('❌ Error in handleMessageUpdate:', error)
    throw error
  }
}

async function handleConnectionUpdate(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    const { state } = data

    console.log('🔗 Processing connection update for instance:', instance, 'state:', state)

    // Update instance status in our database
    let status = 'disconnected'
    if (state === 'open') status = 'connected'
    else if (state === 'connecting') status = 'connecting'
    else if (state === 'close') status = 'disconnected'

    const { error } = await supabase
      .from('whatsapp_instances')
      .update({
        status,
        last_connected_at: status === 'connected' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('instance_key', instance)

    if (error) {
      console.error('❌ Error updating instance status:', error)
    } else {
      console.log('✅ Instance status updated')
    }

  } catch (error) {
    console.error('❌ Error in handleConnectionUpdate:', error)
    throw error
  }
}

function mapMessageStatus(evolutionStatus?: string): string {
  switch (evolutionStatus) {
    case 'PENDING':
      return 'pending'
    case 'SERVER_ACK':
      return 'sent'
    case 'DELIVERY_ACK':
      return 'delivered'
    case 'READ':
      return 'read'
    case 'ERROR':
      return 'failed'
    default:
      return 'delivered'
  }
}

async function getOrCreateWhatsAppSession(
  supabase: any,
  userId: string,
  phoneNumber: string,
  integrationName: string
) {
  // Check if session exists for this phone number
  const { data: existing } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('sender_id', phoneNumber)
    .eq('sender_type', 'whatsapp')
    .single()

  if (existing) {
    return { data: existing, error: null }
  }

  // Create new session
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      sender_id: phoneNumber,
      sender_name: phoneNumber, // Will be updated with contact name if available
      sender_type: 'whatsapp',
      session_metadata: {
        integration_name: integrationName,
        platform: 'whatsapp'
      }
    })
    .select()
    .single()

  return { data, error }
}

async function sendWhatsAppMessage(
  integration: any,
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // This would integrate with actual WhatsApp API
    // For now, we'll simulate the response
    
    if (integration.connection_type === 'cloud_api') {
      // WhatsApp Cloud API integration
      return await sendWhatsAppCloudAPI(integration, to, message)
    } else if (integration.connection_type === 'baileys') {
      // Baileys integration (for local WhatsApp Web)
      return await sendWhatsAppBaileys(integration, to, message)
    }

    throw new Error('Unsupported WhatsApp connection type')
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error)
    return { success: false, error: error.message }
  }
}

async function sendWhatsAppCloudAPI(
  integration: any,
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accessToken = integration.credentials?.access_token
  const phoneNumberId = integration.credentials?.phone_number_id

  if (!accessToken || !phoneNumberId) {
    throw new Error('Missing WhatsApp Cloud API credentials')
  }

  const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace('+', ''),
      type: 'text',
      text: { body: message }
    })
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`)
  }

  return {
    success: true,
    messageId: result.messages?.[0]?.id
  }
}

async function sendWhatsAppBaileys(
  integration: any,
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // This would integrate with a Baileys WebSocket connection
  // For now, we'll return a simulated response
  console.log('Baileys integration not yet implemented')
  
  return {
    success: true,
    messageId: `baileys_${Date.now()}`
  }
} 

async function handleContactsUpdate(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    const { id, notify, verifiedName, pushName } = data

    console.log('👤 Processing contacts update for instance:', instance)

    // Find the WhatsApp instance
    const { data: whatsappInstance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, user_id')
      .eq('instance_key', instance)
      .single()

    if (instanceError || !whatsappInstance) {
      console.error('❌ WhatsApp instance not found:', instance)
      return
    }

    // Extract contact ID from JID
    const contactId = id.replace('@s.whatsapp.net', '').replace('@g.us', '')

    // Update conversation with new contact info
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        contact_name: verifiedName || notify || pushName || undefined,
        contact_metadata: {
          verifiedName,
          notify,
          pushName
        },
        last_synced_at: new Date().toISOString()
      })
      .eq('user_id', whatsappInstance.user_id)
      .eq('integration_type', 'whatsapp')
      .eq('contact_id', contactId)
      .eq('integration_id', whatsappInstance.id)

    if (updateError) {
      console.error('❌ Error updating contact info:', updateError)
    } else {
      console.log('✅ Contact info updated for:', contactId)
    }

  } catch (error) {
    console.error('❌ Error in handleContactsUpdate:', error)
    throw error
  }
}

async function handleChatsUpdate(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    const { id, unreadCount, lastMessageTimestamp } = data

    console.log('💬 Processing chats update for instance:', instance)

    // Find the WhatsApp instance
    const { data: whatsappInstance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, user_id')
      .eq('instance_key', instance)
      .single()

    if (instanceError || !whatsappInstance) {
      console.error('❌ WhatsApp instance not found:', instance)
      return
    }

    // Extract contact ID from JID
    const contactId = id.replace('@s.whatsapp.net', '').replace('@g.us', '')

    // Update conversation with chat info
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        unread_count: unreadCount,
        last_message_at: lastMessageTimestamp ? new Date(lastMessageTimestamp * 1000).toISOString() : undefined,
        last_synced_at: new Date().toISOString()
      })
      .eq('user_id', whatsappInstance.user_id)
      .eq('integration_type', 'whatsapp')
      .eq('contact_id', contactId)
      .eq('integration_id', whatsappInstance.id)

    if (updateError) {
      console.error('❌ Error updating chat info:', updateError)
    } else {
      console.log('✅ Chat info updated for:', contactId)
    }

  } catch (error) {
    console.error('❌ Error in handleChatsUpdate:', error)
    throw error
  }
}

async function handleChatsUpsert(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    const { id, name, unreadCount } = data

    console.log('➕ Processing chats upsert for instance:', instance)

    // Find the WhatsApp instance
    const { data: whatsappInstance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, user_id')
      .eq('instance_key', instance)
      .single()

    if (instanceError || !whatsappInstance) {
      console.error('❌ WhatsApp instance not found:', instance)
      return
    }

    // Extract contact ID and check if it's a group
    const contactId = id.replace('@s.whatsapp.net', '').replace('@g.us', '')
    const isGroup = id.includes('@g.us')

    // Determine contact name
    let contactName = contactId
    if (isGroup) {
      // For groups, use the group subject/name
      contactName = data.subject || name || `Group ${contactId}`
    } else {
      // For individual chats, use the contact name
      contactName = name || contactId
    }

    // Upsert conversation
    const { error: upsertError } = await supabase
      .from('conversations')
      .upsert({
        user_id: whatsappInstance.user_id,
        integration_type: 'whatsapp',
        integration_id: whatsappInstance.id,
        instance_key: instance,
        contact_id: contactId,
        contact_name: contactName,
        contact_metadata: {
          isGroup,
          remoteJid: id,
          unreadCount
        },
        external_conversation_id: id,
        status: 'active',
        unread_count: unreadCount,
        last_synced_at: new Date().toISOString(),
        sync_status: 'synced'
      }, {
        onConflict: 'user_id,integration_type,contact_id,integration_id'
      })

    if (upsertError) {
      console.error('❌ Error upserting chat:', upsertError)
    } else {
      console.log('✅ Chat upserted for:', contactId)
    }

  } catch (error) {
    console.error('❌ Error in handleChatsUpsert:', error)
    throw error
  }
}

async function handlePresenceUpdate(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    const { id, presences } = data

    console.log('👀 Processing presence update for instance:', instance)

    // Find the WhatsApp instance
    const { data: whatsappInstance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, user_id')
      .eq('instance_key', instance)
      .single()

    if (instanceError || !whatsappInstance) {
      console.error('❌ WhatsApp instance not found:', instance)
      return
    }

    // Extract contact ID from JID
    const contactId = id.replace('@s.whatsapp.net', '').replace('@g.us', '')

    // Update conversation with presence info
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        contact_metadata: {
          presence: presences,
          lastPresenceUpdate: new Date().toISOString()
        },
        last_synced_at: new Date().toISOString()
      })
      .eq('user_id', whatsappInstance.user_id)
      .eq('integration_type', 'whatsapp')
      .eq('contact_id', contactId)
      .eq('integration_id', whatsappInstance.id)

    if (updateError) {
      console.error('❌ Error updating presence info:', updateError)
    } else {
      console.log('✅ Presence info updated for:', contactId)
    }

  } catch (error) {
    console.error('❌ Error in handlePresenceUpdate:', error)
    throw error
  }
}

// New handler functions for additional Evolution API events

async function handleApplicationStartup(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('🚀 Application startup for instance:', instance)
    
    // Update instance status to connected
    const { error } = await supabase
      .from('whatsapp_instances')
      .update({
        status: 'connected',
        last_connected_at: new Date().toISOString(),
        metadata: {
          ...data,
          lastStartup: new Date().toISOString()
        }
      })
      .eq('instance_key', instance)

    if (error) {
      console.error('❌ Error updating instance startup status:', error)
    } else {
      console.log('✅ Instance startup status updated')
    }
  } catch (error) {
    console.error('❌ Error in handleApplicationStartup:', error)
  }
}

async function handleQRCodeUpdated(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('📱 QR Code updated for instance:', instance)
    
    // Update instance with QR code info
    const { error } = await supabase
      .from('whatsapp_instances')
      .update({
        status: 'qr_code',
        qr_code: data.qrcode || data.qr,
        metadata: {
          ...data,
          qrUpdatedAt: new Date().toISOString()
        }
      })
      .eq('instance_key', instance)

    if (error) {
      console.error('❌ Error updating QR code:', error)
    } else {
      console.log('✅ QR code updated')
    }
  } catch (error) {
    console.error('❌ Error in handleQRCodeUpdated:', error)
  }
}

async function handleMessagesSet(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('📦 Messages set received for instance:', instance, 'Count:', data?.length || 0)
    
    // This event typically contains bulk message data
    // Process each message in the set
    if (Array.isArray(data)) {
      for (const messageData of data) {
        const messageEvent: EvolutionWebhookEvent = {
          event: 'MESSAGES_UPSERT',
          instance,
          data: messageData
        }
        await handleMessageUpsert(supabase, messageEvent)
      }
    }
  } catch (error) {
    console.error('❌ Error in handleMessagesSet:', error)
  }
}

async function handleMessageDelete(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    const messageId = data.key?.id || data.id
    
    console.log('🗑️ Message delete for instance:', instance, 'Message ID:', messageId)
    
    if (!messageId) {
      console.log('⚠️ No message ID found in delete event')
      return
    }

    // Get the conversation ID before marking message as deleted
    const { data: messageToDelete } = await supabase
      .from('conversation_messages')
      .select('conversation_id')
      .eq('external_message_id', messageId)
      .single()

    // Mark message as deleted
    const { error } = await supabase
      .from('conversation_messages')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        external_metadata: {
          ...data,
          deletedBy: 'evolution_api'
        }
      })
      .eq('external_message_id', messageId)

    if (error) {
      console.error('❌ Error marking message as deleted:', error)
      return
    }

    // Update conversation preview with the latest non-deleted message
    if (messageToDelete?.conversation_id) {
      const { data: latestMessage } = await supabase
        .from('conversation_messages')
        .select('content, sender_type, external_timestamp')
        .eq('conversation_id', messageToDelete.conversation_id)
        .neq('status', 'deleted')
        .order('external_timestamp', { ascending: false })
        .limit(1)
        .single()

      if (latestMessage) {
        await supabase
          .from('conversations')
          .update({
            last_message_at: latestMessage.external_timestamp,
            last_message_preview: latestMessage.content.substring(0, 100),
            last_message_from: latestMessage.sender_type === 'agent' ? 'agent' : 'contact',
            updated_at: new Date().toISOString()
          })
          .eq('id', messageToDelete.conversation_id)
      }
    }

    console.log('✅ Message marked as deleted and conversation preview updated')
  } catch (error) {
    console.error('❌ Error in handleMessageDelete:', error)
  }
}

async function handleSendMessage(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('📤 Send message event for instance:', instance)
    
    // This is typically fired when a message is sent
    // We can use this to track outgoing message analytics
    await handleMessageUpsert(supabase, {
      ...event,
      event: 'MESSAGES_UPSERT'
    })
  } catch (error) {
    console.error('❌ Error in handleSendMessage:', error)
  }
}

async function handleContactsSet(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('📇 Contacts set received for instance:', instance, 'Count:', data?.length || 0)
    
    // This event typically contains bulk contact data
    if (Array.isArray(data)) {
      for (const contactData of data) {
        const contactEvent: EvolutionWebhookEvent = {
          event: 'CONTACTS_UPSERT',
          instance,
          data: contactData
        }
        await handleContactsUpdate(supabase, contactEvent)
      }
    }
  } catch (error) {
    console.error('❌ Error in handleContactsSet:', error)
  }
}

async function handleChatsSet(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('💬 Chats set received for instance:', instance, 'Count:', data?.length || 0)
    
    // This event typically contains bulk chat data
    if (Array.isArray(data)) {
      for (const chatData of data) {
        const chatEvent: EvolutionWebhookEvent = {
          event: 'CHATS_UPSERT',
          instance,
          data: chatData
        }
        await handleChatsUpsert(supabase, chatEvent)
      }
    }
  } catch (error) {
    console.error('❌ Error in handleChatsSet:', error)
  }
}

async function handleChatsDelete(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    const chatId = data.id
    
    console.log('🗑️ Chat delete for instance:', instance, 'Chat ID:', chatId)
    
    if (!chatId) {
      console.log('⚠️ No chat ID found in delete event')
      return
    }

    const contactId = chatId.replace('@s.whatsapp.net', '').replace('@g.us', '')

    // Find the WhatsApp instance
    const { data: whatsappInstance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, user_id')
      .eq('instance_key', instance)
      .single()

    if (instanceError || !whatsappInstance) {
      console.error('❌ WhatsApp instance not found:', instance)
      return
    }

    // Mark conversation as deleted/archived
    const { error } = await supabase
      .from('conversations')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString()
      })
      .eq('user_id', whatsappInstance.user_id)
      .eq('integration_type', 'whatsapp')
      .eq('contact_id', contactId)
      .eq('integration_id', whatsappInstance.id)

    if (error) {
      console.error('❌ Error archiving conversation:', error)
    } else {
      console.log('✅ Conversation archived')
    }
  } catch (error) {
    console.error('❌ Error in handleChatsDelete:', error)
  }
}

async function handleGroupsUpsert(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('👥 Groups upsert for instance:', instance)
    
    // Handle group creation/update similar to chats
    await handleChatsUpsert(supabase, {
      ...event,
      event: 'CHATS_UPSERT'
    })
  } catch (error) {
    console.error('❌ Error in handleGroupsUpsert:', error)
  }
}

async function handleGroupUpdate(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('👥 Group update for instance:', instance)
    
    // Handle group updates similar to chat updates
    await handleChatsUpdate(supabase, {
      ...event,
      event: 'CHATS_UPDATE'
    })
  } catch (error) {
    console.error('❌ Error in handleGroupUpdate:', error)
  }
}

async function handleGroupParticipantsUpdate(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    const { id, participants, action } = data
    
    console.log('👥 Group participants update for instance:', instance, 'Action:', action)
    
    const contactId = id.replace('@g.us', '')

    // Find the WhatsApp instance
    const { data: whatsappInstance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('id, user_id')
      .eq('instance_key', instance)
      .single()

    if (instanceError || !whatsappInstance) {
      console.error('❌ WhatsApp instance not found:', instance)
      return
    }

    // Update conversation metadata with participant info
    const { error } = await supabase
      .from('conversations')
      .update({
        contact_metadata: {
          isGroup: true,
          remoteJid: id,
          participants,
          lastParticipantUpdate: {
            action,
            participants,
            timestamp: new Date().toISOString()
          }
        },
        last_synced_at: new Date().toISOString()
      })
      .eq('user_id', whatsappInstance.user_id)
      .eq('integration_type', 'whatsapp')
      .eq('contact_id', contactId)
      .eq('integration_id', whatsappInstance.id)

    if (error) {
      console.error('❌ Error updating group participants:', error)
    } else {
      console.log('✅ Group participants updated')
    }
  } catch (error) {
    console.error('❌ Error in handleGroupParticipantsUpdate:', error)
  }
}

async function handleCall(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('📞 Call event for instance:', instance)
    
    // Log call events for analytics
    const { error } = await supabase
      .from('conversation_analytics')
      .upsert({
        conversation_id: null, // We don't have conversation context for calls
        total_calls: 1,
        last_call_at: new Date().toISOString(),
        metadata: {
          callData: data,
          instance
        }
      })

    if (error) {
      console.error('❌ Error logging call event:', error)
    } else {
      console.log('✅ Call event logged')
    }
  } catch (error) {
    console.error('❌ Error in handleCall:', error)
  }
}

async function handleNewJwtToken(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('🔑 New JWT token for instance:', instance)
    
    // Update instance with new token info (don't store the actual token)
    const { error } = await supabase
      .from('whatsapp_instances')
      .update({
        metadata: {
          tokenRefreshedAt: new Date().toISOString(),
          tokenInfo: {
            // Don't store the actual token for security
            refreshed: true,
            timestamp: new Date().toISOString()
          }
        },
        last_connected_at: new Date().toISOString()
      })
      .eq('instance_key', instance)

    if (error) {
      console.error('❌ Error updating token info:', error)
    } else {
      console.log('✅ Token refresh logged')
    }
  } catch (error) {
    console.error('❌ Error in handleNewJwtToken:', error)
  }
}

async function handleLogoutInstance(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('🚪 Instance logout for:', instance)
    
    // Update WhatsApp instance status to disconnected
    const { error } = await supabase
      .from('whatsapp_instances')
      .update({
        status: 'disconnected',
        connection_status: 'logout',
        last_disconnected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('instance_key', instance)
    
    if (error) {
      console.error('❌ Error updating instance logout:', error)
    } else {
      console.log('✅ Instance logout processed')
    }
  } catch (error) {
    console.error('❌ Error in handleLogoutInstance:', error)
  }
}

async function handleRemoveInstance(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('🗑️ Instance removal for:', instance)
    
    // Mark WhatsApp instance as removed (don't delete for audit trail)
    const { error } = await supabase
      .from('whatsapp_instances')
      .update({
        status: 'removed',
        connection_status: 'removed',
        removed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('instance_key', instance)
    
    if (error) {
      console.error('❌ Error updating instance removal:', error)
    } else {
      console.log('✅ Instance removal processed')
    }
  } catch (error) {
    console.error('❌ Error in handleRemoveInstance:', error)
  }
}

async function handleLabelsAssociation(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('🏷️ Labels association for instance:', instance)
    
    // Store label association data for WhatsApp Business features
    const { error } = await supabase
      .from('conversation_sync_events')
      .insert({
        integration_type: 'whatsapp',
        event_type: 'labels_association',
        event_data: {
          instance,
          labels: data,
          timestamp: new Date().toISOString()
        },
        processed: true,
        processed_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('❌ Error storing labels association:', error)
    } else {
      console.log('✅ Labels association processed')
    }
  } catch (error) {
    console.error('❌ Error in handleLabelsAssociation:', error)
  }
}

async function handleLabelsEdit(supabase: any, event: EvolutionWebhookEvent) {
  try {
    const { instance, data } = event
    console.log('✏️ Labels edit for instance:', instance)
    
    // Store label edit data for WhatsApp Business features
    const { error } = await supabase
      .from('conversation_sync_events')
      .insert({
        integration_type: 'whatsapp',
        event_type: 'labels_edit',
        event_data: {
          instance,
          labelChanges: data,
          timestamp: new Date().toISOString()
        },
        processed: true,
        processed_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('❌ Error storing labels edit:', error)
    } else {
      console.log('✅ Labels edit processed')
    }
  } catch (error) {
    console.error('❌ Error in handleLabelsEdit:', error)
  }
}