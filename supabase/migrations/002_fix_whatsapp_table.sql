-- Migration to create whatsapp_instances table if it doesn't exist
-- This ensures compatibility with frontend code

-- First check if whatsapp_integrations exists and whatsapp_instances doesn't
DO $$
BEGIN
    -- If whatsapp_integrations exists but whatsapp_instances doesn't, create whatsapp_instances as an alias/view
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'whatsapp_integrations') 
       AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'whatsapp_instances') THEN
        
        -- Create whatsapp_instances table with the same structure as whatsapp_integrations
        CREATE TABLE whatsapp_instances (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            connection_type TEXT NOT NULL CHECK (connection_type IN ('baileys', 'cloud_api')),
            phone_number TEXT,
            instance_key TEXT UNIQUE,
            qr_code TEXT,
            status TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
            credentials JSONB DEFAULT '{}',
            settings JSONB DEFAULT '{}',
            last_connected_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Copy data from whatsapp_integrations to whatsapp_instances
        INSERT INTO whatsapp_instances SELECT * FROM whatsapp_integrations;

        -- Enable RLS
        ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
        CREATE POLICY "Users can view own instances" ON whatsapp_instances
            FOR SELECT USING (auth.uid() = user_id);

        CREATE POLICY "Users can create instances" ON whatsapp_instances
            FOR INSERT WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can update own instances" ON whatsapp_instances
            FOR UPDATE USING (auth.uid() = user_id);

        CREATE POLICY "Users can delete own instances" ON whatsapp_instances
            FOR DELETE USING (auth.uid() = user_id);

        -- Create indexes
        CREATE INDEX idx_whatsapp_instances_user_id ON whatsapp_instances(user_id);
        CREATE INDEX idx_whatsapp_instances_status ON whatsapp_instances(status);
        CREATE INDEX idx_whatsapp_instances_instance_key ON whatsapp_instances(instance_key);

        -- Create trigger for updated_at
        CREATE TRIGGER update_whatsapp_instances_updated_at 
            BEFORE UPDATE ON whatsapp_instances 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        -- Add to realtime publication
        ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_instances;

    ELSIF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'whatsapp_instances') 
         AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'whatsapp_integrations') THEN
        
        -- Neither table exists, create whatsapp_instances
        CREATE TABLE whatsapp_instances (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            connection_type TEXT NOT NULL CHECK (connection_type IN ('baileys', 'cloud_api')),
            phone_number TEXT,
            instance_key TEXT UNIQUE,
            qr_code TEXT,
            status TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
            credentials JSONB DEFAULT '{}',
            settings JSONB DEFAULT '{}',
            last_connected_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Enable RLS
        ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
        CREATE POLICY "Users can view own instances" ON whatsapp_instances
            FOR SELECT USING (auth.uid() = user_id);

        CREATE POLICY "Users can create instances" ON whatsapp_instances
            FOR INSERT WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can update own instances" ON whatsapp_instances
            FOR UPDATE USING (auth.uid() = user_id);

        CREATE POLICY "Users can delete own instances" ON whatsapp_instances
            FOR DELETE USING (auth.uid() = user_id);

        -- Create indexes
        CREATE INDEX idx_whatsapp_instances_user_id ON whatsapp_instances(user_id);
        CREATE INDEX idx_whatsapp_instances_status ON whatsapp_instances(status);
        CREATE INDEX idx_whatsapp_instances_instance_key ON whatsapp_instances(instance_key);

        -- Create trigger for updated_at
        CREATE TRIGGER update_whatsapp_instances_updated_at 
            BEFORE UPDATE ON whatsapp_instances 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        -- Add to realtime publication
        ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_instances;
    END IF;
END
$$;

-- Migration to fix whatsapp_instances table structure
-- Add missing columns to match the expected schema

-- Check if connection_type column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'whatsapp_instances' 
        AND column_name = 'connection_type'
    ) THEN
        ALTER TABLE whatsapp_instances 
        ADD COLUMN connection_type TEXT NOT NULL DEFAULT 'baileys'
        CHECK (connection_type IN ('baileys', 'cloud_api'));
        
        RAISE NOTICE 'Added connection_type column to whatsapp_instances';
    END IF;
END
$$;

-- Check if instance_key column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'whatsapp_instances' 
        AND column_name = 'instance_key'
    ) THEN
        ALTER TABLE whatsapp_instances 
        ADD COLUMN instance_key TEXT UNIQUE;
        
        -- Update existing rows with generated instance keys
        UPDATE whatsapp_instances 
        SET instance_key = 'instance_' || id::text 
        WHERE instance_key IS NULL;
        
        -- Make it NOT NULL after updating existing rows
        ALTER TABLE whatsapp_instances 
        ALTER COLUMN instance_key SET NOT NULL;
        
        RAISE NOTICE 'Added instance_key column to whatsapp_instances';
    END IF;
END
$$;

-- Check if credentials column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'whatsapp_instances' 
        AND column_name = 'credentials'
    ) THEN
        ALTER TABLE whatsapp_instances 
        ADD COLUMN credentials JSONB DEFAULT '{}';
        
        RAISE NOTICE 'Added credentials column to whatsapp_instances';
    END IF;
END
$$;

-- Check if last_connected_at column exists but last_seen doesn't, rename it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'whatsapp_instances' 
        AND column_name = 'last_seen'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'whatsapp_instances' 
        AND column_name = 'last_connected_at'
    ) THEN
        ALTER TABLE whatsapp_instances 
        RENAME COLUMN last_seen TO last_connected_at;
        
        RAISE NOTICE 'Renamed last_seen to last_connected_at in whatsapp_instances';
    END IF;
END
$$;

-- Ensure the table has proper constraints and indexes
DO $$
BEGIN
    -- Add index on instance_key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'whatsapp_instances' 
        AND indexname = 'idx_whatsapp_instances_instance_key'
    ) THEN
        CREATE INDEX idx_whatsapp_instances_instance_key ON whatsapp_instances(instance_key);
        RAISE NOTICE 'Created index on instance_key';
    END IF;
    
    -- Add index on user_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'whatsapp_instances' 
        AND indexname = 'idx_whatsapp_instances_user_id'
    ) THEN
        CREATE INDEX idx_whatsapp_instances_user_id ON whatsapp_instances(user_id);
        RAISE NOTICE 'Created index on user_id';
    END IF;
    
    -- Add index on status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'whatsapp_instances' 
        AND indexname = 'idx_whatsapp_instances_status'
    ) THEN
        CREATE INDEX idx_whatsapp_instances_status ON whatsapp_instances(status);
        RAISE NOTICE 'Created index on status';
    END IF;
END
$$; 