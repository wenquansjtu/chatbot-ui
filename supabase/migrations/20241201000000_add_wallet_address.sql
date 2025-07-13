-- 添加钱包地址字段到profiles表
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_address TEXT CHECK (char_length(wallet_address) <= 100);

-- 创建钱包地址索引
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_address ON profiles (wallet_address);

-- 添加钱包地址的唯一约束（可选，如果需要确保一个钱包地址只能对应一个用户）
-- ALTER TABLE profiles ADD CONSTRAINT unique_wallet_address UNIQUE (wallet_address);

-- 更新RLS策略以允许通过钱包地址查询
CREATE POLICY "Allow users to read profiles by wallet address"
    ON profiles FOR SELECT
    USING (wallet_address = auth.jwt() ->> 'wallet_address' OR user_id = auth.uid());