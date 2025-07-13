# 积分系统部署指南

## 问题解决

如果你遇到以下错误：
```
ERROR: policy "Users can view their own points" for table "user_points" already exists (SQLSTATE 42710)
```

这说明基础积分系统已经存在，但策略名称冲突。

## 解决方案

### 方法1：使用新的迁移文件（推荐）

1. **跳过第一个迁移文件**（如果基础积分系统已存在）
2. **运行新的迁移文件**：
   ```sql
   -- 运行这个文件来添加新功能
   supabase/migrations/20241201000003_add_new_points_rules_only.sql
   ```

### 方法2：手动修复现有迁移文件

如果你需要运行第一个迁移文件，请使用修改后的版本，它包含了安全检查：

```sql
-- 用户积分表策略
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_points' AND policyname = 'Users can view their own points') THEN
        CREATE POLICY "Users can view their own points" ON user_points
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    -- ... 其他策略
END $$;
```

## 部署步骤

### 1. 检查现有状态
```sql
-- 检查是否已有积分系统
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'user_points'
);
```

### 2. 部署新功能
```sql
-- 如果基础系统不存在，先运行：
-- supabase/migrations/20241201000001_add_points_system.sql

-- 然后运行新功能：
-- supabase/migrations/20241201000003_add_new_points_rules_only.sql
```

### 3. 验证部署
```sql
-- 检查新表是否创建成功
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('daily_first_conversation_records', 'image_share_x_records');

-- 检查函数是否创建成功
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('daily_first_conversation_bonus', 'image_share_x_bonus');
```

## 功能验证

### 1. 每日第一次对话奖励
- 创建新对话时应该自动触发
- 检查控制台是否有奖励信息
- 验证积分是否正确增加

### 2. 图片分享到X奖励
- 点击分享按钮生成图片
- 点击"Share to X"按钮
- 应该显示成功提示和积分奖励

### 3. 积分显示
- 在设置页面查看积分卡片
- 应该显示三种获得积分的方式
- 验证积分总数是否正确

## 故障排除

### 常见问题

1. **策略已存在错误**
   - 使用 `20241201000003_add_new_points_rules_only.sql` 文件
   - 该文件使用安全检查避免冲突

2. **函数不存在错误**
   - 确保运行了包含函数的迁移文件
   - 检查函数名称是否正确

3. **表不存在错误**
   - 确保按顺序运行迁移文件
   - 检查表名是否正确

### 调试命令

```sql
-- 检查所有积分相关表
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE '%points%' OR table_name LIKE '%conversation%' OR table_name LIKE '%share%';

-- 检查所有积分相关函数
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%bonus%' OR routine_name LIKE '%check%';

-- 检查策略
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('user_points', 'check_in_records', 'daily_first_conversation_records', 'image_share_x_records');
```

## 回滚方案

如果需要回滚，可以运行以下SQL：

```sql
-- 删除新表
DROP TABLE IF EXISTS daily_first_conversation_records CASCADE;
DROP TABLE IF EXISTS image_share_x_records CASCADE;

-- 删除新函数
DROP FUNCTION IF EXISTS daily_first_conversation_bonus(UUID, UUID);
DROP FUNCTION IF EXISTS image_share_x_bonus(UUID, UUID, TEXT);
```

## 注意事项

1. **备份数据**：在部署前备份现有数据
2. **测试环境**：先在测试环境验证功能
3. **用户通知**：告知用户新的积分规则
4. **监控日志**：部署后监控错误日志 