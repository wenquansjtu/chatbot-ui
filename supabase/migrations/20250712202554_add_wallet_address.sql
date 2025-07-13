-- 添加钱包地址字段到profiles表
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- 为 wallet_address 添加唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_wallet_address ON profiles(wallet_address);

-- 更新RLS策略以允许通过钱包地址查询（如果不存在则创建）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Allow users to read profiles by wallet address'
    ) THEN
        CREATE POLICY "Allow users to read profiles by wallet address"
            ON profiles FOR SELECT
            USING (wallet_address = auth.jwt() ->> 'wallet_address' OR user_id = auth.uid());
    END IF;
END $$;
