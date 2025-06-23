# Unified Chat Management System

## Overview

The Unified Chat Management System is a comprehensive solution for managing conversations across multiple messaging platforms (WhatsApp, Instagram, Web Chat, etc.) with integrated RAG (Retrieval-Augmented Generation) capabilities. This system provides a consistent interface for conversation management regardless of the underlying messaging platform.

## Architecture

### Core Principles

1. **Platform Independence**: All conversations are stored in a unified format, independent of the source platform
2. **RAG-Ready**: Conversation data is structured to support AI-powered responses with context
3. **Real-time Synchronization**: Webhooks and sync events keep data up-to-date
4. **Scalable Design**: Supports multiple integrations and high message volumes
5. **Consistent API**: Same functions work across all platforms

### Database Schema

#### Core Tables

##### `conversations`
The central table for all conversations across all platforms.

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Integration details
  integration_type TEXT NOT NULL CHECK (integration_type IN ('whatsapp', 'instagram', 'web', 'api', 'telegram', 'messenger')),
  integration_id UUID, -- References platform-specific instance tables
  instance_key TEXT, -- For quick lookup
  
  -- Contact information
  contact_id TEXT NOT NULL, -- Phone number, username, session ID, etc.
  contact_name TEXT,
  contact_metadata JSONB DEFAULT '{}',
  
  -- Conversation state
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived', 'handed_off')),
  assigned_agent_id UUID REFERENCES auth.users(id),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  tags TEXT[] DEFAULT '{}',
  
  -- Message statistics
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_preview TEXT,
  last_message_from TEXT, -- 'contact' or 'agent' or 'bot'
  
  -- RAG context
  conversation_summary TEXT, -- AI-generated summary for RAG context
  conversation_topics TEXT[] DEFAULT '{}', -- Extracted topics for better RAG retrieval
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  
  -- Synchronization
  external_conversation_id TEXT, -- Original conversation ID from external API
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'failed')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, integration_type, contact_id, integration_id)
);
```

##### `conversation_messages`
Unified message storage across all platforms.

```sql
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Message content
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'sticker', 'reaction')),
  media_url TEXT, -- For media messages
  media_metadata JSONB DEFAULT '{}',
  
  -- Message direction and sender
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('contact', 'agent', 'bot')),
  sender_name TEXT,
  sender_id TEXT,
  
  -- Message status
  status TEXT DEFAULT 'delivered' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  
  -- AI processing
  ai_processed BOOLEAN DEFAULT false,
  ai_response_time_ms INTEGER,
  ai_model_used TEXT,
  ai_confidence_score DECIMAL(3,2),
  ai_tokens_used INTEGER,
  
  -- External API details
  external_message_id TEXT, -- Original message ID from external API
  external_timestamp TIMESTAMP WITH TIME ZONE,
  external_metadata JSONB DEFAULT '{}',
  
  -- RAG context for this specific message
  rag_context_used TEXT, -- RAG context that was used to generate response
  rag_sources TEXT[], -- Document/webpage IDs used for RAG
  rag_similarity_scores DECIMAL(3,2)[], -- Similarity scores for RAG sources
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

##### `conversation_sync_events`
Webhook and synchronization event tracking.

```sql
CREATE TABLE conversation_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  integration_id UUID,
  
  event_type TEXT NOT NULL, -- 'message_received', 'message_sent', 'status_update', etc.
  event_data JSONB NOT NULL,
  
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Services

### ConversationService

The main service that provides a unified API for conversation management.

#### Key Methods

```typescript
// Get all conversations for a user
async getAllConversations(userId: string, filters?: {
  integration_type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<UnifiedConversation[]>

// Get messages for a specific conversation
async getConversationMessages(conversationId: string, limit = 50): Promise<UnifiedMessage[]>

// Send a message through the appropriate integration
async sendMessage(conversationId: string, content: string, messageType = 'text'): Promise<UnifiedMessage>

// Sync conversations from external APIs
async syncWhatsAppConversations(userId: string, instanceId: string): Promise<number>

// Get conversation context for RAG
async getConversationContextForRAG(conversationId: string, messageLimit = 10): Promise<string>

// Update conversation summary and topics for RAG
async updateConversationRAGData(conversationId: string, summary: string, topics: string[], sentiment?: string): Promise<void>
```

## Integration Flow

### 1. Initial Synchronization

When a new integration is connected:

1. **Fetch Existing Conversations**: Pull all existing conversations from the external API
2. **Create Unified Records**: Convert platform-specific data to unified format
3. **Store in Database**: Insert conversations and messages into unified tables
4. **Set Up Webhooks**: Configure real-time synchronization

```typescript
// Example: WhatsApp Integration
const syncedCount = await conversationService.syncWhatsAppConversations(userId, instanceId);
console.log(`Synced ${syncedCount} WhatsApp conversations`);
```

### 2. Real-time Synchronization

Webhooks process incoming events:

1. **Webhook Receives Event**: Evolution API sends message/status updates
2. **Event Processing**: Parse and validate webhook data
3. **Database Update**: Create/update conversations and messages
4. **RAG Processing**: Extract topics and update conversation context
5. **Real-time Updates**: Notify frontend via Supabase realtime

### 3. Message Sending

Unified message sending across platforms:

1. **Receive Send Request**: Frontend requests to send message
2. **Lookup Conversation**: Find conversation and integration details
3. **Route to Platform**: Call appropriate platform API (WhatsApp, Instagram, etc.)
4. **Store Message**: Save sent message in unified format
5. **Update Conversation**: Update last message and statistics

## RAG Integration

### Conversation Context

The system provides rich context for RAG:

```typescript
// Get formatted conversation context for AI
const context = await conversationService.getConversationContextForRAG(conversationId, 10);
// Returns: "Customer: Hello, I need help\nAssistant: How can I help you today?\n..."
```

### Conversation Summaries

AI-generated summaries for better RAG retrieval:

```typescript
// Update conversation with AI insights
await conversationService.updateConversationRAGData(
  conversationId,
  "Customer inquiry about product pricing and availability",
  ["pricing", "product", "availability"],
  "neutral"
);
```

### Message-Level RAG Data

Each message can store RAG context:

- `rag_context_used`: The context that was used to generate the response
- `rag_sources`: IDs of documents/webpages used
- `rag_similarity_scores`: Relevance scores for each source

## Webhook Handling

### Evolution API Webhooks

The system handles these Evolution API events:

1. **messages.upsert**: New or updated messages
2. **messages.update**: Message status changes
3. **connection.update**: Instance connection status

```typescript
// Webhook handler processes events
switch (event.event) {
  case 'messages.upsert':
    await handleMessageUpsert(supabase, event);
    break;
  case 'messages.update':
    await handleMessageUpdate(supabase, event);
    break;
  case 'connection.update':
    await handleConnectionUpdate(supabase, event);
    break;
}
```

## Frontend Integration

### Conversations Page

The unified system powers a WhatsApp-like conversation interface:

```typescript
// Load all conversations
const conversations = await conversationService.getAllConversations(userId, {
  integration_type: 'whatsapp',
  status: 'active',
  limit: 50
});

// Load messages for selected conversation
const messages = await conversationService.getConversationMessages(conversationId);

// Send message
const sentMessage = await conversationService.sendMessage(conversationId, "Hello!");
```

### Real-time Updates

Supabase realtime subscriptions keep the UI updated:

```typescript
// Subscribe to conversation changes
supabase
  .channel('conversations')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, 
    (payload) => {
      // Update UI with new conversation data
    })
  .subscribe();
```

## Platform Support

### Current Integrations

- **WhatsApp (Evolution API)**: Full support with real-time sync
- **Instagram**: Planned
- **Web Chat**: Planned
- **Telegram**: Planned
- **Facebook Messenger**: Planned

### Adding New Platforms

To add a new platform:

1. **Create Integration Table**: Platform-specific connection details
2. **Implement Sync Methods**: Convert platform data to unified format
3. **Add Webhook Handlers**: Process real-time events
4. **Update Conversation Service**: Add platform-specific sending logic

## Benefits

### For RAG System

1. **Consistent Context**: All conversations follow the same format
2. **Rich Metadata**: Topics, sentiment, and summaries enhance retrieval
3. **Message History**: Complete conversation history for context
4. **Source Tracking**: Know which documents influenced responses

### For Users

1. **Unified Interface**: Same UI works for all platforms
2. **Cross-Platform Search**: Find conversations across all integrations
3. **Consistent Features**: Tags, priorities, and analytics work everywhere
4. **Real-time Updates**: Instant synchronization across all platforms

### For Developers

1. **Single API**: One service handles all platforms
2. **Easy Extension**: Add new platforms without changing core logic
3. **Scalable Architecture**: Handles high message volumes
4. **Comprehensive Logging**: Full audit trail of all events

## Performance Considerations

### Database Optimization

- **Indexed Queries**: Optimized for common access patterns
- **Partitioning**: Large tables can be partitioned by date/user
- **Connection Pooling**: Efficient database connection management

### Caching Strategy

- **Message Caching**: Recent messages cached for fast access
- **Conversation Lists**: Cached conversation summaries
- **RAG Context**: Cached conversation context for AI

### Scalability

- **Horizontal Scaling**: Database can be scaled across multiple instances
- **Message Queues**: Webhook processing can use queues for high volume
- **CDN Integration**: Media files served via CDN

## Security

### Data Protection

- **Row Level Security**: Users can only access their own data
- **Encrypted Storage**: Sensitive data encrypted at rest
- **Audit Logging**: All actions logged for compliance

### API Security

- **Authentication**: All requests require valid user tokens
- **Rate Limiting**: Prevent abuse of API endpoints
- **Input Validation**: All data validated before processing

## Monitoring

### Health Checks

- **Sync Status**: Monitor synchronization success rates
- **Message Delivery**: Track message delivery success
- **Webhook Processing**: Monitor webhook event processing

### Analytics

- **Conversation Metrics**: Response times, resolution rates
- **Platform Performance**: Compare performance across platforms
- **RAG Effectiveness**: Track AI response quality

## Future Enhancements

### Planned Features

1. **Advanced Analytics**: Conversation insights and trends
2. **Multi-Agent Support**: Multiple agents per conversation
3. **Conversation Routing**: Intelligent conversation assignment
4. **Template Messages**: Reusable message templates
5. **Conversation Export**: Export conversations for analysis
6. **Advanced Search**: Full-text search across all conversations

### AI Enhancements

1. **Sentiment Analysis**: Real-time sentiment detection
2. **Intent Recognition**: Automatic intent classification
3. **Auto-Summarization**: AI-generated conversation summaries
4. **Predictive Routing**: AI-powered conversation routing
5. **Response Suggestions**: AI-suggested responses for agents

This unified chat management system provides a robust foundation for handling conversations across multiple platforms while maintaining the flexibility and context needed for effective RAG-powered AI responses. 