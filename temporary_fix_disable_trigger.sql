-- 临时解决方案：禁用触发器，让用户注册成功

-- 1. 禁用触发器
ALTER TABLE auth.users DISABLE TRIGGER trigger_initialize_user_points;

-- 2. 或者完全删除触发器（如果上面的方法不行）
-- DROP TRIGGER IF EXISTS trigger_initialize_user_points ON auth.users;

-- 3. 确保 user_points 表存在
CREATE TABLE IF NOT EXISTS public.user_points (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    points INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 4. 为现有用户手动创建积分记录
INSERT INTO public.user_points (user_id, points)
SELECT id, 0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_points)
ON CONFLICT (user_id) DO NOTHING;

-- 5. 设置基本权限
GRANT ALL PRIVILEGES ON TABLE public.user_points TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.user_points TO service_role;

-- 6. 启用 RLS
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- 7. 创建基本策略
DROP POLICY IF EXISTS "Users can view their own points" ON public.user_points;
CREATE POLICY "Users can view their own points" ON public.user_points
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own points" ON public.user_points;
CREATE POLICY "Users can update their own points" ON public.user_points
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own points" ON public.user_points;
CREATE POLICY "Users can insert their own points" ON public.user_points
    FOR INSERT WITH CHECK (auth.uid() = user_id); 