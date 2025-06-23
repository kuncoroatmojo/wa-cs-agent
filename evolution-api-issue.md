/messages/findMessages remoteJid filter not working

### Welcome!

* Yes, I have searched for similar issues on GitHub and found none.

### What did you do?

I discovered that the `/messages/findMessages/${instanceKey}` endpoint's filtering by `remoteJid` is not working as expected. When trying to fetch messages for a specific conversation using this endpoint with the `remoteJid` parameter in the request body, it doesn't properly filter the messages.

As a workaround, I had to:
1. Use `/messages/fetch/${instanceKey}` to get all messages
2. Filter the messages client-side by matching `remoteJid`
3. Sort and limit the results manually

Example of the current workaround:
```typescript
// Get all messages since Evolution API's findMessages filter by remoteJid doesn't work
const response = await this.makeRequest(`/messages/fetch/${instanceKey}`, 'GET');
const allMessages = await response.json();

// Filter messages for this conversation
const conversationMessages = allMessages.filter((msg: any) => {
  const msgJid = msg.key?.remoteJid?.toLowerCase();
  const targetJid = remoteJid.toLowerCase();
  return msgJid === targetJid;
});

// Sort by timestamp and limit
const sortedMessages = conversationMessages
  .sort((a: any, b: any) => (b.messageTimestamp || 0) - (a.messageTimestamp || 0))
  .slice(0, limit);
```

### What did you expect?

The `/messages/findMessages/${instanceKey}` endpoint should properly filter messages by the provided `remoteJid` parameter in the request body, returning only messages from that specific conversation.

### What did you observe instead of what you expected?

The endpoint either:
1. Returns all messages regardless of the `remoteJid` parameter
2. Or returns an empty array

This forces us to fetch all messages and filter them client-side, which is less efficient and could cause performance issues with large message histories.

### Which version of the API are you using?

Latest (2.3.0)

### What is your environment?

Docker

### Additional Notes

This issue impacts applications that need to efficiently load conversation histories. The current workaround of fetching all messages and filtering client-side could cause performance issues, especially for instances with many messages or high message volume.

Potential fix suggestions:
1. Fix the `remoteJid` filtering in the `/messages/findMessages/${instanceKey}` endpoint
2. Or document that filtering should be done client-side and update the API docs accordingly
3. Or add a new endpoint specifically designed for efficient conversation message fetching 