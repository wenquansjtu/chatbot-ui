-- 修复 user_points 表的权限问题

-- 1. 确保 public schema 中的 user_points 表存在
CREATE TABLE IF NOT EXISTS public.user_points (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    points INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. 删除旧的触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_initialize_user_points ON auth.users;

-- 3. 删除旧的函数（如果存在）
DROP FUNCTION IF EXISTS initialize_user_points();

-- 4. 创建新的函数，使用 SECURITY DEFINER 来获得必要的权限
CREATE OR REPLACE FUNCTION initialize_user_points()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_points (user_id, points)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 重新创建触发器
CREATE TRIGGER trigger_initialize_user_points
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION initialize_user_points();

-- 6. 确保 RLS 策略正确设置
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Users can view their own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can update their own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can insert their own points" ON public.user_points;

-- 创建新的策略
CREATE POLICY "Users can view their own points" ON public.user_points
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own points" ON public.user_points
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own points" ON public.user_points
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. 为现有用户创建积分记录（如果还没有的话）
INSERT INTO public.user_points (user_id, points)
SELECT id, 0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_points)
ON CONFLICT (user_id) DO NOTHING;

-- 8. 确保索引存在
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON public.user_points(user_id); 