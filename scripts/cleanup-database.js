import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pfirjlhuulkchogjbvsv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const cleanupDatabase = async () => {
  try {
    console.log('🧹 Starting database cleanup...');
    
    // 1. Delete all conversation messages
    console.log('🗑️ Deleting all conversation messages...');
    const { error: messagesError } = await supabase
      .from('conversation_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all except impossible ID
    
    if (messagesError) {
      console.error('❌ Error deleting messages:', messagesError.message);
    } else {
      console.log('✅ All conversation messages deleted');
    }
    
    // 2. Delete all conversations
    console.log('🗑️ Deleting all conversations...');
    const { error: conversationsError } = await supabase
      .from('conversations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all except impossible ID
    
    if (conversationsError) {
      console.error('❌ Error deleting conversations:', conversationsError.message);
    } else {
      console.log('✅ All conversations deleted');
    }
    
    // 3. Clean up related tables
    console.log('🗑️ Cleaning up related tables...');
    
    // Delete conversation participants
    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (participantsError) {
      console.warn('⚠️ Note: Error deleting participants (table might not exist):', participantsError.message);
    } else {
      console.log('✅ All conversation participants deleted');
    }
    
    // Delete sync events
    const { error: syncEventsError } = await supabase
      .from('conversation_sync_events')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (syncEventsError) {
      console.warn('⚠️ Note: Error deleting sync events (table might not exist):', syncEventsError.message);
    } else {
      console.log('✅ All conversation sync events deleted');
    }
    
    // Delete analytics
    const { error: analyticsError } = await supabase
      .from('conversation_analytics')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (analyticsError) {
      console.warn('⚠️ Note: Error deleting analytics (table might not exist):', analyticsError.message);
    } else {
      console.log('✅ All conversation analytics deleted');
    }
    
    // 4. Verify cleanup
    console.log('\n📊 Verifying cleanup...');
    
    const { count: messageCount } = await supabase
      .from('conversation_messages')
      .select('*', { count: 'exact', head: true });
    
    const { count: conversationCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📈 Final counts:`);
    console.log(`  - Conversations: ${conversationCount || 0}`);
    console.log(`  - Messages: ${messageCount || 0}`);
    
    console.log('\n🎉 Database cleanup completed successfully!');
    console.log('💡 You can now go to WhatsApp Instances and run "Sync Conversations" to re-populate with fresh data.');
    
  } catch (error) {
    console.error('❌ Database cleanup failed:', error.message);
    process.exit(1);
  }
};

cleanupDatabase(); 