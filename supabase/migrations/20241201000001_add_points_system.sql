-- 创建用户积分表
CREATE TABLE IF NOT EXISTS user_points (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    points INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);

-- 启用RLS
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_points' AND policyname = 'Users can view their own points') THEN
        CREATE POLICY "Users can view their own points" ON user_points
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_points' AND policyname = 'Users can update their own points') THEN
        CREATE POLICY "Users can update their own points" ON user_points
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_points' AND policyname = 'Users can insert their own points') THEN
        CREATE POLICY "Users can insert their own points" ON user_points
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 创建函数来初始化用户积分
CREATE OR REPLACE FUNCTION initialize_user_points()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_points (user_id, points)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器，当新用户注册时自动创建积分记录（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_initialize_user_points') THEN
        CREATE TRIGGER trigger_initialize_user_points
            AFTER INSERT ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION initialize_user_points();
    END IF;
END $$; 