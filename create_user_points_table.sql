-- 创建用户积分表
CREATE TABLE IF NOT EXISTS public.user_points (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    points INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON public.user_points(user_id);

-- 启用RLS
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS "Users can view their own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can update their own points" ON public.user_points;
DROP POLICY IF EXISTS "Users can insert their own points" ON public.user_points;

-- 创建RLS策略
CREATE POLICY "Users can view their own points" ON public.user_points
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own points" ON public.user_points
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own points" ON public.user_points
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 删除已存在的函数和触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_initialize_user_points ON auth.users;
DROP FUNCTION IF EXISTS initialize_user_points();

-- 创建函数来初始化用户积分
CREATE OR REPLACE FUNCTION initialize_user_points()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_points (user_id, points)
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

-- 为现有用户创建积分记录（如果还没有的话）
INSERT INTO public.user_points (user_id, points)
SELECT id, 0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_points)
ON CONFLICT (user_id) DO NOTHING; 