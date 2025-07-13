-- 创建用户积分表
CREATE TABLE IF NOT EXISTS user_points (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    points INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 创建打卡记录表
CREATE TABLE IF NOT EXISTS check_in_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    check_in_date DATE DEFAULT CURRENT_DATE NOT NULL,
    points_earned INTEGER DEFAULT 100 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, check_in_date)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_check_in_records_user_id ON check_in_records(user_id);
CREATE INDEX IF NOT EXISTS idx_check_in_records_date ON check_in_records(check_in_date);

-- 创建RLS策略
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_records ENABLE ROW LEVEL SECURITY;

-- 用户积分表策略
CREATE POLICY "Users can view their own points" ON user_points
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own points" ON user_points
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own points" ON user_points
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 打卡记录表策略
CREATE POLICY "Users can view their own check-in records" ON check_in_records
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own check-in records" ON check_in_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);

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

-- 创建触发器，当新用户注册时自动创建积分记录
CREATE TRIGGER trigger_initialize_user_points
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION initialize_user_points();

-- 创建函数来处理每日打卡
CREATE OR REPLACE FUNCTION daily_check_in(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    today_check_in RECORD;
    current_points INTEGER;
    result JSON;
BEGIN
    -- 检查今天是否已经打卡
    SELECT * INTO today_check_in 
    FROM check_in_records 
    WHERE user_id = user_uuid AND check_in_date = CURRENT_DATE;
    
    IF today_check_in IS NOT NULL THEN
        -- 今天已经打卡
        result := json_build_object(
            'success', false,
            'message', 'Today already checked in',
            'points_earned', 0
        );
    ELSE
        -- 今天还没打卡，执行打卡
        INSERT INTO check_in_records (user_id, check_in_date, points_earned)
        VALUES (user_uuid, CURRENT_DATE, 100);
        
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
            'message', 'Check-in successful',
            'points_earned', 100,
            'total_points', current_points
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;