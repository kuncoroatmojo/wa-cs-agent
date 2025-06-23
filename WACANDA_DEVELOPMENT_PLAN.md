# 🤖 Wacanda RAG-Powered AI Customer Service Agent
## Comprehensive Development Plan

### 📋 Project Overview

Wacanda is a sophisticated RAG-powered AI customer service agent that provides:
- **Dual Mode Operation**: Backend API + Admin Dashboard
- **Multi-Channel Support**: WhatsApp, WhatWut, and other integrations
- **Advanced RAG**: Document + Web page processing with vector search
- **Smart Context Management**: Sender-grouped conversations with history
- **Flexible AI Configuration**: Custom API keys and model settings

### 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Admin Dashboard│◄──►│   Supabase DB    │◄──►│  Edge Functions │
│   (React + TS)  │    │  (PostgreSQL +   │    │   (AI Logic)    │
└─────────────────┘    │    pgvector)     │    └─────────────────┘
                       └──────────────────┘             ▲
                                ▲                       │
                                │                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  External APIs  │◄──►│   API Gateway    │◄──►│   RAG Engine    │
│ (WhatWut, etc.) │    │ (Edge Functions) │    │ (LangChain +    │
└─────────────────┘    └──────────────────┘    │   OpenAI)       │
                                               └─────────────────┘
                                                        ▲
                                                        │
                                               ┌─────────────────┐
                                               │  Knowledge Base │
                                               │ (Docs + Web +   │
                                               │   Embeddings)   │
                                               └─────────────────┘
```

## 🎯 Phase 1: Core Infrastructure & Database (Week 1)

### 1.1 Project Setup & Configuration

**Tasks**:
- [ ] Initialize React + TypeScript project with Vite
- [ ] Configure Supabase client and authentication
- [ ] Set up Tailwind CSS with custom design system
- [ ] Configure development environment

**Files to Create**:
```
wacanda/
├── package.json                       # Dependencies and scripts
├── vite.config.ts                     # Vite configuration
├── tailwind.config.js                 # Tailwind customization
├── tsconfig.json                      # TypeScript configuration
├── .env.example                       # Environment template
├── .env.local                         # Local environment
└── README.md                          # Project documentation
```

### 1.2 Database Schema Design

**Objective**: Create comprehensive database schema for all Wacanda features

**Core Tables**:
```sql
-- User management and authentication
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Configuration per organization/user
CREATE TABLE ai_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'openai', -- openai, anthropic, etc.
  api_key TEXT NOT NULL, -- encrypted
  model_name TEXT NOT NULL DEFAULT 'gpt-4o',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,
  system_prompt TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat sessions grouped by sender
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL, -- phone number, user id, etc.
  sender_name TEXT,
  sender_type TEXT NOT NULL, -- whatsapp, whatwut, api, etc.
  session_metadata JSONB DEFAULT '{}',
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, sender_id, sender_type)
);

-- Individual messages within sessions
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- text, image, document, etc.
  metadata JSONB DEFAULT '{}',
  tokens_used INTEGER,
  model_used TEXT,
  confidence_score DECIMAL(3,2),
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge base documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  folder_path TEXT DEFAULT '/',
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Web pages for context
CREATE TABLE web_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  content TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scraping', 'ready', 'error')),
  include_children BOOLEAN DEFAULT false,
  max_depth INTEGER DEFAULT 1,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vector embeddings for RAG
CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  source_id UUID NOT NULL, -- references documents or web_pages
  source_type TEXT NOT NULL CHECK (source_type IN ('document', 'webpage')),
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RAG contexts for tracking what was used
CREATE TABLE rag_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  source_documents UUID[] DEFAULT '{}',
  similarity_scores DECIMAL[] DEFAULT '{}',
  context_used TEXT,
  retrieval_query TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp integrations
CREATE TABLE whatsapp_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('baileys', 'cloud_api')),
  phone_number TEXT,
  instance_key TEXT UNIQUE,
  qr_code TEXT,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
  credentials JSONB DEFAULT '{}', -- encrypted
  settings JSONB DEFAULT '{}',
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- External API integrations (WhatWut, etc.)
CREATE TABLE external_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  integration_type TEXT NOT NULL, -- whatwut, custom, etc.
  api_key TEXT, -- encrypted
  webhook_url TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable vector similarity search
CREATE INDEX ON document_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_integrations ENABLE ROW LEVEL SECURITY;
```

### 1.3 Core TypeScript Types

**Files to Create**:
```typescript
// src/types/index.ts
export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface AIConfiguration {
  id: string;
  user_id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'custom';
  api_key: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  system_prompt?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  sender_id: string;
  sender_name?: string;
  sender_type: 'whatsapp' | 'whatwut' | 'api' | 'dashboard';
  session_metadata: Record<string, any>;
  last_message_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_type: 'text' | 'image' | 'document' | 'audio';
  metadata: Record<string, any>;
  tokens_used?: number;
  model_used?: string;
  confidence_score?: number;
  response_time_ms?: number;
  created_at: string;
  rag_context?: RAGContext;
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  content?: string;
  file_path?: string;
  file_type?: string;
  file_size?: number;
  folder_path: string;
  upload_date: string;
  processed_date?: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WebPage {
  id: string;
  user_id: string;
  url: string;
  title?: string;
  content?: string;
  scraped_at?: string;
  status: 'pending' | 'scraping' | 'ready' | 'error';
  include_children: boolean;
  max_depth: number;
  error_message?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DocumentEmbedding {
  id: string;
  user_id: string;
  source_id: string;
  source_type: 'document' | 'webpage';
  chunk_text: string;
  chunk_index: number;
  embedding: number[];
  metadata: Record<string, any>;
  created_at: string;
}

export interface RAGContext {
  id: string;
  message_id: string;
  source_documents: string[];
  similarity_scores: number[];
  context_used: string;
  retrieval_query: string;
  created_at: string;
}

export interface WhatsAppIntegration {
  id: string;
  user_id: string;
  name: string;
  connection_type: 'baileys' | 'cloud_api';
  phone_number?: string;
  instance_key: string;
  qr_code?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  credentials: Record<string, any>;
  settings: Record<string, any>;
  last_connected_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalIntegration {
  id: string;
  user_id: string;
  name: string;
  integration_type: string;
  api_key?: string;
  webhook_url?: string;
  settings: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

## 🎯 Phase 2: Core Backend Services (Week 2)

### 2.1 Supabase Edge Functions

**Core Functions to Create**:

```typescript
// supabase/functions/chat-completion/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ChatRequest {
  session_id: string;
  message: string;
  sender_id: string;
  sender_type: string;
  use_rag?: boolean;
}

serve(async (req) => {
  try {
    const { session_id, message, sender_id, sender_type, use_rag = true }: ChatRequest = await req.json()
    
    // 1. Get or create chat session
    // 2. Get AI configuration
    // 3. Retrieve conversation history
    // 4. Perform RAG search if enabled
    // 5. Generate AI response
    // 6. Store message and response
    // 7. Return response
    
    return new Response(JSON.stringify({ success: true, response: "Generated response" }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
```

```typescript
// supabase/functions/document-process/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const { document_id } = await req.json()
    
    // 1. Get document from database
    // 2. Extract text content using LangChain
    // 3. Split into chunks
    // 4. Generate embeddings
    // 5. Store embeddings in database
    // 6. Update document status
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
```

```typescript
// supabase/functions/webpage-scrape/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const { webpage_id } = await req.json()
    
    // 1. Get webpage record
    // 2. Scrape webpage content
    // 3. Process child pages if enabled
    // 4. Extract and clean text
    // 5. Generate embeddings
    // 6. Store in database
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
```

### 2.2 Core Services

**Files to Create**:
```typescript
// src/services/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.SUPABASE_URL!
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// src/services/chatService.ts
import { supabase } from './supabase'
import type { ChatSession, ChatMessage } from '../types'

export class ChatService {
  async getSessionsBySender(userId: string): Promise<ChatSession[]> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select(`
        *,
        messages:chat_messages(*)
      `)
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async createOrGetSession(
    userId: string,
    senderId: string,
    senderType: string,
    senderName?: string
  ): Promise<ChatSession> {
    // Check if session exists
    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('sender_id', senderId)
      .eq('sender_type', senderType)
      .single()

    if (existing) return existing

    // Create new session
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        sender_id: senderId,
        sender_type: senderType,
        sender_name: senderName,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async sendMessage(
    sessionId: string,
    message: string,
    useRag: boolean = true
  ): Promise<ChatMessage> {
    // Call edge function for chat completion
    const { data, error } = await supabase.functions.invoke('chat-completion', {
      body: {
        session_id: sessionId,
        message: message,
        use_rag: useRag,
      },
    })

    if (error) throw error
    return data
  }
}

// src/services/documentService.ts
import { supabase } from './supabase'
import type { Document } from '../types'

export class DocumentService {
  async uploadDocument(
    userId: string,
    file: File,
    folderPath: string = '/'
  ): Promise<Document> {
    // Upload file to Supabase Storage
    const fileName = `${userId}/${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // Create document record
    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        title: file.name,
        file_path: uploadData.path,
        file_type: file.type,
        file_size: file.size,
        folder_path: folderPath,
      })
      .select()
      .single()

    if (error) throw error

    // Trigger processing
    await supabase.functions.invoke('document-process', {
      body: { document_id: data.id },
    })

    return data
  }

  async getDocuments(userId: string, folderPath?: string): Promise<Document[]> {
    let query = supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (folderPath) {
      query = query.eq('folder_path', folderPath)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  async deleteDocument(documentId: string): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)

    if (error) throw error
  }
}

// src/services/webPageService.ts
import { supabase } from './supabase'
import type { WebPage } from '../types'

export class WebPageService {
  async addWebPage(
    userId: string,
    url: string,
    includeChildren: boolean = false,
    maxDepth: number = 1
  ): Promise<WebPage> {
    const { data, error } = await supabase
      .from('web_pages')
      .insert({
        user_id: userId,
        url,
        include_children: includeChildren,
        max_depth: maxDepth,
      })
      .select()
      .single()

    if (error) throw error

    // Trigger scraping
    await supabase.functions.invoke('webpage-scrape', {
      body: { webpage_id: data.id },
    })

    return data
  }

  async getWebPages(userId: string): Promise<WebPage[]> {
    const { data, error } = await supabase
      .from('web_pages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }
}
```

## 🎯 Phase 3: Admin Dashboard UI (Week 3)

### 3.1 Core Dashboard Components

**Files to Create**:
```typescript
// src/components/Dashboard/Layout.tsx
import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export const DashboardLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// src/components/Dashboard/Sidebar.tsx
import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  ChatBubbleLeftRightIcon,
  CogIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  PhoneIcon,
  PuzzlePieceIcon
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Chats', href: '/dashboard/chats', icon: ChatBubbleLeftRightIcon },
  { name: 'Documents', href: '/dashboard/documents', icon: DocumentTextIcon },
  { name: 'Web Pages', href: '/dashboard/webpages', icon: GlobeAltIcon },
  { name: 'WhatsApp', href: '/dashboard/whatsapp', icon: PhoneIcon },
  { name: 'Integrations', href: '/dashboard/integrations', icon: PuzzlePieceIcon },
  { name: 'Settings', href: '/dashboard/settings', icon: CogIcon },
]

export const Sidebar: React.FC = () => {
  return (
    <div className="w-64 bg-white shadow-lg">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Wacanda</h1>
        <p className="text-sm text-gray-500">AI Customer Service</p>
      </div>
      <nav className="mt-6">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
```

### 3.2 Chat Management Components

```typescript
// src/components/Chat/ChatList.tsx
import React, { useEffect } from 'react'
import { useChatStore } from '../../store/chatStore'
import { ChatSessionCard } from './ChatSessionCard'

export const ChatList: React.FC = () => {
  const { sessions, loading, fetchSessions } = useChatStore()

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  if (loading) {
    return <div className="flex justify-center p-8">Loading chats...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Chat Sessions</h2>
        <div className="flex items-center space-x-4">
          <input
            type="search"
            placeholder="Search chats..."
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      
      <div className="grid gap-4">
        {sessions.map((session) => (
          <ChatSessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  )
}

// src/components/Chat/ChatSessionCard.tsx
import React from 'react'
import { ChatSession } from '../../types'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  session: ChatSession
}

export const ChatSessionCard: React.FC<Props> = ({ session }) => {
  const lastMessage = session.messages?.[0]
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium">
                {session.sender_name?.[0] || session.sender_id[0]}
              </span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">
                {session.sender_name || session.sender_id}
              </h3>
              <p className="text-sm text-gray-500">
                {session.sender_type} • {formatDistanceToNow(new Date(session.last_message_at))} ago
              </p>
            </div>
          </div>
          
          {lastMessage && (
            <div className="mt-4">
              <p className="text-gray-600 text-sm line-clamp-2">
                {lastMessage.content}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            session.is_active
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {session.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </div>
  )
}

// src/components/Chat/ChatInterface.tsx
import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useChatStore } from '../../store/chatStore'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'

export const ChatInterface: React.FC = () => {
  const { sessionId } = useParams()
  const { currentSession, messages, loading, fetchSession, sendMessage } = useChatStore()

  useEffect(() => {
    if (sessionId) {
      fetchSession(sessionId)
    }
  }, [sessionId, fetchSession])

  const handleSendMessage = async (content: string) => {
    if (sessionId) {
      await sendMessage(sessionId, content)
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-full">Loading...</div>
  }

  if (!currentSession) {
    return <div className="flex justify-center items-center h-full">Chat not found</div>
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          {currentSession.sender_name || currentSession.sender_id}
        </h2>
        <p className="text-sm text-gray-500">
          {currentSession.sender_type} conversation
        </p>
      </div>
      
      <MessageList messages={messages} />
      <MessageInput onSendMessage={handleSendMessage} />
    </div>
  )
}
```

### 3.3 AI Configuration Components

```typescript
// src/components/Settings/AIConfiguration.tsx
import React, { useState, useEffect } from 'react'
import { useAIConfigStore } from '../../store/aiConfigStore'
import { AIConfigurationForm } from './AIConfigurationForm'

export const AIConfiguration: React.FC = () => {
  const { configurations, activeConfig, loading, fetchConfigurations } = useAIConfigStore()
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchConfigurations()
  }, [fetchConfigurations])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Configuration</h2>
          <p className="text-gray-600">Manage your AI models and settings</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Configuration
        </button>
      </div>

      <div className="grid gap-4">
        {configurations.map((config) => (
          <div
            key={config.id}
            className={`p-6 rounded-lg border-2 transition-colors ${
              config.is_active
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{config.name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {config.provider} • {config.model_name}
                </p>
                <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                  <span>Temperature: {config.temperature}</span>
                  <span>Max Tokens: {config.max_tokens}</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {config.is_active && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    Active
                  </span>
                )}
                <button className="text-gray-400 hover:text-gray-600">
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <AIConfigurationForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            fetchConfigurations()
          }}
        />
      )}
    </div>
  )
}
```

## 🎯 Phase 4: Integration & API Layer (Week 4)

### 4.1 External API Integration

```typescript
// src/services/integrationService.ts
import { supabase } from './supabase'

export class IntegrationService {
  // WhatsApp Integration
  async createWhatsAppIntegration(data: {
    name: string
    connection_type: 'baileys' | 'cloud_api'
    credentials: Record<string, any>
  }) {
    const { data: integration, error } = await supabase
      .from('whatsapp_integrations')
      .insert(data)
      .select()
      .single()

    if (error) throw error

    // Initialize WhatsApp connection
    await supabase.functions.invoke('whatsapp-connect', {
      body: { integration_id: integration.id }
    })

    return integration
  }

  // WhatWut Integration
  async createWhatWutIntegration(data: {
    name: string
    api_key: string
    webhook_url: string
  }) {
    const { data: integration, error } = await supabase
      .from('external_integrations')
      .insert({
        ...data,
        integration_type: 'whatwut'
      })
      .select()
      .single()

    if (error) throw error
    return integration
  }
}

// supabase/functions/whatsapp-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const body = await req.json()
    
    // Parse WhatsApp webhook payload
    const { from, message, timestamp } = body
    
    // Find integration by phone number or instance
    // Create or get chat session
    // Process message through RAG system
    // Send response back to WhatsApp
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})

// supabase/functions/external-api/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    // Public API endpoint for external services like WhatWut
    const { action, ...payload } = await req.json()
    
    switch (action) {
      case 'chat':
        return await handleChatRequest(payload)
      case 'webhook':
        return await handleWebhook(payload)
      default:
        throw new Error('Invalid action')
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
```

## 🎯 Phase 5: Advanced Features & Performance Optimization (Week 5-6)

### 5.1 Advanced RAG Features

**Objective**: Enhance RAG capabilities with intelligent context management and multi-modal support

**Advanced RAG Implementation**:
```typescript
// src/services/ragService.ts
import { supabase } from './supabase'
import { OpenAI } from 'openai'

export class RAGService {
  private openai: OpenAI

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey })
  }

  async performSemanticSearch(
    userId: string,
    query: string,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<DocumentChunk[]> {
    // Generate query embedding
    const embedding = await this.generateEmbedding(query)
    
    // Vector similarity search
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
      user_id: userId
    })

    if (error) throw error
    return data
  }

  async generateContextualResponse(
    userId: string,
    sessionId: string,
    userMessage: string,
    conversationHistory: ChatMessage[],
    useRAG: boolean = true
  ): Promise<{
    response: string;
    sources: DocumentChunk[];
    confidence: number;
    tokensUsed: number;
  }> {
    let context = ""
    let sources: DocumentChunk[] = []
    
    if (useRAG) {
      // Retrieve relevant documents
      sources = await this.performSemanticSearch(userId, userMessage)
      context = sources.map(chunk => chunk.content).join('\n\n')
    }

    // Build conversation context
    const conversationContext = conversationHistory
      .slice(-10) // Last 10 messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')

    // Get AI configuration
    const aiConfig = await this.getActiveAIConfig(userId)
    
    // Generate response
    const completion = await this.openai.chat.completions.create({
      model: aiConfig.model_name,
      temperature: aiConfig.temperature,
      max_tokens: aiConfig.max_tokens,
      messages: [
        {
          role: 'system',
          content: aiConfig.system_prompt || this.getDefaultSystemPrompt()
        },
        {
          role: 'system',
          content: `Context from knowledge base:\n${context}`
        },
        {
          role: 'system',
          content: `Conversation history:\n${conversationContext}`
        },
        {
          role: 'user',
          content: userMessage
        }
      ]
    })

    const response = completion.choices[0].message.content || ''
    const tokensUsed = completion.usage?.total_tokens || 0
    
    // Calculate confidence based on context relevance
    const confidence = this.calculateConfidence(sources, userMessage)

    return {
      response,
      sources,
      confidence,
      tokensUsed
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    })
    return response.data[0].embedding
  }

  private calculateConfidence(sources: DocumentChunk[], query: string): number {
    if (sources.length === 0) return 0.3
    
    const avgSimilarity = sources.reduce((sum, source) => sum + source.similarity, 0) / sources.length
    return Math.min(avgSimilarity * 1.2, 1.0) // Boost slightly, cap at 1.0
  }

  private getDefaultSystemPrompt(): string {
    return `You are Wacanda, an intelligent AI customer service assistant. 
    
Your core capabilities:
- Provide accurate, helpful responses using the knowledge base context
- Maintain a professional yet friendly tone
- Escalate to human agents when needed
- Remember conversation context and refer to previous messages when relevant
- Always cite sources when using specific information from the knowledge base

Guidelines:
- If you're unsure about information, say so clearly
- Ask clarifying questions when needed
- Keep responses concise but complete
- Use the conversation history to maintain context
- If confidence is low, recommend human agent assistance`
  }
}
```

### 5.2 Intelligent Handoff System

**Human Agent Handoff Logic**:
```typescript
// src/services/handoffService.ts
export class HandoffService {
  async evaluateHandoffNeed(
    message: ChatMessage,
    context: ConversationContext,
    confidence: number
  ): Promise<{
    shouldHandoff: boolean;
    reason: string;
    urgency: 'low' | 'medium' | 'high';
  }> {
    const triggers = [
      this.checkConfidenceThreshold(confidence),
      this.checkKeywordTriggers(message.content),
      this.checkSentimentTriggers(context.sentiment),
      this.checkComplexityTriggers(message.content),
      this.checkEscalationRequest(message.content)
    ]

    const activeTrigggers = triggers.filter(t => t.triggered)
    
    if (activeTrigggers.length > 0) {
      const highestUrgency = this.determineUrgency(activeTrigggers)
      return {
        shouldHandoff: true,
        reason: activeTrigggers.map(t => t.reason).join(', '),
        urgency: highestUrgency
      }
    }

    return {
      shouldHandoff: false,
      reason: '',
      urgency: 'low'
    }
  }

  private checkConfidenceThreshold(confidence: number) {
    return {
      triggered: confidence < 0.6,
      reason: 'Low AI confidence',
      urgency: 'medium' as const
    }
  }

  private checkKeywordTriggers(content: string) {
    const urgentKeywords = ['cancel', 'refund', 'complaint', 'angry', 'frustrated', 'legal']
    const hasUrgentKeyword = urgentKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    )
    
    return {
      triggered: hasUrgentKeyword,
      reason: 'Urgent keywords detected',
      urgency: 'high' as const
    }
  }

  private checkEscalationRequest(content: string) {
    const escalationPhrases = ['speak to human', 'human agent', 'real person', 'manager']
    const requestsHuman = escalationPhrases.some(phrase => 
      content.toLowerCase().includes(phrase)
    )
    
    return {
      triggered: requestsHuman,
      reason: 'Customer requested human agent',
      urgency: 'high' as const
    }
  }

  async createHandoffTicket(
    sessionId: string,
    reason: string,
    urgency: 'low' | 'medium' | 'high'
  ): Promise<void> {
    // Create handoff record
    await supabase.from('handoff_requests').insert({
      session_id: sessionId,
      reason,
      urgency,
      status: 'pending',
      created_at: new Date().toISOString()
    })

    // Notify available agents
    await this.notifyAvailableAgents(urgency)
  }

  private async notifyAvailableAgents(urgency: string): Promise<void> {
    // Implementation for agent notification system
    // Could use Supabase Realtime, webhooks, or push notifications
  }
}
```

## 🎯 Phase 6: Testing, Deployment & Production (Week 7-8)

### 6.1 Comprehensive Testing Strategy

**Testing Framework Setup**:
```json
// package.json additions
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "msw": "^2.0.0",
    "cypress": "^13.0.0",
    "playwright": "^1.40.0"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open"
  }
}
```

### 6.2 Production Deployment

**Environment Configuration**:
```bash
# .env.production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=production
VITE_SENTRY_DSN=your-sentry-dsn
VITE_API_BASE_URL=https://api.wacanda.com

# Supabase Edge Functions Environment
OPENAI_API_KEY=your-openai-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key
WEBHOOK_SECRET=your-webhook-secret
```

**Vercel Deployment**:
```json
// vercel.json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "outputDirectory": "dist",
  "functions": {
    "app/api/**/*.ts": {
      "runtime": "nodejs18.x"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## 🎯 Phase 7: Documentation & Maintenance (Ongoing)

### 7.1 API Documentation

**OpenAPI Specification**:
```yaml
# docs/api-spec.yaml
openapi: 3.0.3
info:
  title: Wacanda AI Customer Service API
  description: RAG-powered AI customer service agent API
  version: 1.0.0
  contact:
    name: API Support
    email: support@wacanda.com

servers:
  - url: https://api.wacanda.com/v1
    description: Production server
  - url: https://staging-api.wacanda.com/v1
    description: Staging server

paths:
  /chat/sessions:
    post:
      summary: Create or get chat session
      tags:
        - Chat
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                sender_id:
                  type: string
                  description: Unique identifier for the sender
                sender_type:
                  type: string
                  enum: [whatsapp, email, api, web]
                sender_name:
                  type: string
                  description: Display name for the sender
              required:
                - sender_id
                - sender_type
      responses:
        '200':
          description: Session created or retrieved successfully

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - BearerAuth: []
```

### 7.2 Success Metrics & KPIs

**Technical Metrics**:
- **Response Time**: < 2 seconds for AI responses
- **Uptime**: > 99.9% availability
- **Error Rate**: < 0.1% of requests
- **RAG Accuracy**: > 85% relevance score

**Business Metrics**:
- **Customer Satisfaction**: > 4.5/5 rating
- **Resolution Rate**: > 80% issues resolved by AI
- **Response Time**: < 30 seconds first response
- **Handoff Rate**: < 15% conversations require human agent

### 7.3 Future Enhancements

**Planned Features (Roadmap)**:
1. **Multi-language Support**: Auto-detect and respond in customer's language
2. **Voice Integration**: Voice notes and voice responses
3. **Video Chat Support**: Screen sharing and video calls
4. **Advanced Analytics**: Predictive analytics and insights
5. **Workflow Automation**: Custom automation rules and triggers
6. **Integration Marketplace**: Pre-built integrations with popular tools
7. **Mobile Apps**: Native iOS and Android applications
8. **Enterprise SSO**: SAML and OAuth integrations
9. **Custom Models**: Fine-tuned models for specific industries
10. **Collaborative Features**: Multi-agent collaboration tools

## 🚀 Development Timeline Summary

**Week 1**: Core Infrastructure & Database
**Week 2**: Core Backend Services & Edge Functions
**Week 3**: Admin Dashboard UI Components
**Week 4**: Integration & API Layer
**Week 5-6**: Advanced Features & Performance Optimization
**Week 7-8**: Testing, Deployment & Production Setup
**Ongoing**: Documentation, Maintenance & Feature Updates

This development plan provides a complete roadmap for building Wacanda as a sophisticated RAG-powered AI customer service agent with both API capabilities and an admin dashboard. The plan covers all requested features including AI configuration management, chat grouping by sender, document/web page management, WhatsApp integration, and external service connectivity, with proper testing, deployment, and maintenance strategies for a production-ready solution.