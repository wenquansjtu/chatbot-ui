-- 创建每日第一次对话记录表
CREATE TABLE IF NOT EXISTS daily_first_conversation_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    conversation_date DATE DEFAULT CURRENT_DATE NOT NULL,
    points_earned INTEGER DEFAULT 100 NOT NULL,
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, conversation_date)
);

-- 创建图片分享到X记录表
CREATE TABLE IF NOT EXISTS image_share_x_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    share_date DATE DEFAULT CURRENT_DATE NOT NULL,
    points_earned INTEGER DEFAULT 200 NOT NULL,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    image_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_daily_first_conversation_user_id ON daily_first_conversation_records(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_first_conversation_date ON daily_first_conversation_records(conversation_date);
CREATE INDEX IF NOT EXISTS idx_image_share_x_user_id ON image_share_x_records(user_id);
CREATE INDEX IF NOT EXISTS idx_image_share_x_date ON image_share_x_records(share_date);

-- 启用RLS
ALTER TABLE daily_first_conversation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_share_x_records ENABLE ROW LEVEL SECURITY;

-- 创建函数来处理每日第一次对话奖励
CREATE OR REPLACE FUNCTION daily_first_conversation_bonus(user_uuid UUID, chat_uuid UUID)
RETURNS JSON AS $$
DECLARE
    today_conversation RECORD;
    current_points INTEGER;
    result JSON;
BEGIN
    -- 检查今天是否已经有第一次对话记录
    SELECT * INTO today_conversation 
    FROM daily_first_conversation_records 
    WHERE user_id = user_uuid AND conversation_date = CURRENT_DATE;
    
    IF today_conversation IS NOT NULL THEN
        -- 今天已经有第一次对话记录
        result := json_build_object(
            'success', false,
            'message', 'Already earned first conversation bonus today',
            'points_earned', 0
        );
    ELSE
        -- 今天还没有第一次对话记录，创建记录并奖励积分
        INSERT INTO daily_first_conversation_records (user_id, conversation_date, points_earned, chat_id)
        VALUES (user_uuid, CURRENT_DATE, 100, chat_uuid);
        
        -- 更新用户积分
        UPDATE user_points 
        SET points = points + 100, updated_at = NOW()
        WHERE user_id = user_uuid;
        
        -- 获取当前积分
        SELECT points INTO current_points 
        FROM user_points 
        WHERE user_id = user_uuid;
        
        result := json_build_object(
            'success', true,
            'message', 'First conversation bonus earned!',
            'points_earned', 100,
            'total_points', current_points
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 创建函数来处理图片分享到X奖励
CREATE OR REPLACE FUNCTION image_share_x_bonus(user_uuid UUID, message_uuid UUID, image_path TEXT)
RETURNS JSON AS $$
DECLARE
    current_points INTEGER;
    result JSON;
BEGIN
    -- 创建分享记录
    INSERT INTO image_share_x_records (user_id, share_date, points_earned, message_id, image_path)
    VALUES (user_uuid, CURRENT_DATE, 200, message_uuid, image_path);
    
    -- 更新用户积分
    UPDATE user_points 
    SET points = points + 200, updated_at = NOW()
    WHERE user_id = user_uuid;
    
    -- 获取当前积分
    SELECT points INTO current_points 
    FROM user_points 
    WHERE user_id = user_uuid;
    
    result := json_build_object(
        'success', true,
        'message', 'Image shared to X! Bonus earned!',
        'points_earned', 200,
        'total_points', current_points
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 手动创建策略（如果不存在）
DO $$ 
BEGIN
    -- 每日第一次对话记录表策略
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_first_conversation_records' AND policyname = 'Users can view their own daily first conversation records') THEN
        CREATE POLICY "Users can view their own daily first conversation records" ON daily_first_conversation_records
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_first_conversation_records' AND policyname = 'Users can insert their own daily first conversation records') THEN
        CREATE POLICY "Users can insert their own daily first conversation records" ON daily_first_conversation_records
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    
    -- 图片分享到X记录表策略
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'image_share_x_records' AND policyname = 'Users can view their own image share X records') THEN
        CREATE POLICY "Users can view their own image share X records" ON image_share_x_records
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'image_share_x_records' AND policyname = 'Users can insert their own image share X records') THEN
        CREATE POLICY "Users can insert their own image share X records" ON image_share_x_records
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$; 