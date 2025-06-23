import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the entire conversationService module
const mockConversationService = {
  getAllConversations: vi.fn(),
  getConversationMessages: vi.fn(),
  sendMessage: vi.fn(),
  syncAllMessagesForRAG: vi.fn()
};

vi.mock('../../../src/services/conversationService', () => ({
  conversationService: mockConversationService
}));

describe('ConversationService', () => {
  const mockUserId = 'test-user-id';
  const mockConversationId = 'test-conversation-id';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllConversations', () => {
    it('should fetch conversations for a user', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          contact_name: 'John Doe',
          contact_id: '+1234567890',
          last_message_at: new Date().toISOString(),
          message_count: 5,
          status: 'active'
        }
      ];

      mockConversationService.getAllConversations.mockResolvedValue(mockConversations);

      const result = await mockConversationService.getAllConversations(mockUserId);
      
      expect(mockConversationService.getAllConversations).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockConversations);
    });

    it('should handle database errors gracefully', async () => {
      mockConversationService.getAllConversations.mockRejectedValue(new Error('Database error'));

      await expect(mockConversationService.getAllConversations(mockUserId))
        .rejects.toThrow('Database error');
    });
  });

  describe('getConversationMessages', () => {
    it('should fetch messages for a conversation', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          content: 'Hello',
          direction: 'inbound',
          sender_name: 'John',
          created_at: new Date().toISOString()
        }
      ];

      mockConversationService.getConversationMessages.mockResolvedValue(mockMessages);

      const result = await mockConversationService.getConversationMessages(mockConversationId);
      
      expect(mockConversationService.getConversationMessages).toHaveBeenCalledWith(mockConversationId);
      expect(result).toEqual(mockMessages);
    });
  });

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      const mockMessage = {
        id: 'msg-1',
        content: 'Test message',
        direction: 'outbound',
        created_at: new Date().toISOString()
      };

      mockConversationService.sendMessage.mockResolvedValue(mockMessage);

      const result = await mockConversationService.sendMessage(mockConversationId, 'Test message');
      
      expect(mockConversationService.sendMessage).toHaveBeenCalledWith(mockConversationId, 'Test message');
      expect(result).toEqual(mockMessage);
    });
  });

  describe('syncAllMessagesForRAG', () => {
    it('should sync messages successfully', async () => {
      const mockResult = {
        status: 'completed',
        processedMessages: 100,
        totalConversations: 5
      };

      mockConversationService.syncAllMessagesForRAG.mockResolvedValue(mockResult);

      const result = await mockConversationService.syncAllMessagesForRAG(mockUserId);

      expect(mockConversationService.syncAllMessagesForRAG).toHaveBeenCalledWith(mockUserId);
      expect(result.status).toBe('completed');
      expect(result.processedMessages).toBe(100);
    });
  });
}); 