-- 彻底修复 user_points 表的权限问题

-- 1. 确保表存在
CREATE TABLE IF NOT EXISTS public.user_points (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    points INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. 授予所有必要的权限
GRANT ALL PRIVILEGES ON TABLE public.user_points TO postgres;
GRANT ALL PRIVILEGES ON TABLE public.user_points TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.user_points TO anon;
GRANT ALL PRIVILEGES ON TABLE public.user_points TO service_role;

-- 3. 授予序列权限（如果使用自增ID）
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 4. 删除旧的触发器和函数
DROP TRIGGER IF EXISTS trigger_initialize_user_points ON auth.users;
DROP FUNCTION IF EXISTS initialize_user_points();

-- 5. 创建新的函数，使用 SECURITY DEFINER 并以 postgres 用户身份运行
CREATE OR REPLACE FUNCTION initialize_user_points()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_points (user_id, points)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- 记录错误但不中断用户创建
        RAISE WARNING 'Failed to initialize user points for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. 重新创建触发器
CREATE TRIGGER trigger_initialize_user_points
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION initialize_user_points();

-- 7. 确保 RLS 策略正确设置
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- 删除旧的策略
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

-- 8. 为现有用户创建积分记录
INSERT INTO public.user_points (user_id, points)
SELECT id, 0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_points)
ON CONFLICT (user_id) DO NOTHING;

-- 9. 确保索引存在
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON public.user_points(user_id);

-- 10. 验证权限
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasinsert,
    hasselect,
    hasupdate,
    hasdelete
FROM pg_tables 
WHERE tablename = 'user_points'; 