-- 完整修复钱包登录问题

-- 1. 确保 user_points 表存在并设置正确权限
DROP TABLE IF EXISTS public.user_points CASCADE;

CREATE TABLE public.user_points (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    points INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. 授予所有权限
GRANT ALL PRIVILEGES ON TABLE public.user_points TO postgres;
GRANT ALL PRIVILEGES ON TABLE public.user_points TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.user_points TO anon;
GRANT ALL PRIVILEGES ON TABLE public.user_points TO service_role;

-- 3. 创建索引
CREATE INDEX idx_user_points_user_id ON public.user_points(user_id);

-- 4. 启用 RLS
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略
CREATE POLICY "Users can view their own points" ON public.user_points
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own points" ON public.user_points
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own points" ON public.user_points
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. 确保 wallet_address 字段存在
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- 7. 创建 wallet_address 索引
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_address ON profiles(wallet_address);

-- 8. 为所有现有用户创建积分记录
INSERT INTO public.user_points (user_id, points)
SELECT id, 0
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 9. 删除有问题的触发器和函数
DROP TRIGGER IF EXISTS trigger_initialize_user_points ON auth.users;
DROP FUNCTION IF EXISTS initialize_user_points();

-- 10. 验证修复
SELECT COUNT(*) as total_users FROM auth.users;
SELECT COUNT(*) as total_points_records FROM public.user_points;
SELECT COUNT(*) as profiles_with_wallet FROM profiles WHERE wallet_address IS NOT NULL; 