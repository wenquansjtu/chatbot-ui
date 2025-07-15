# 彻底解决 user_points 权限问题

## 问题分析
用户注册时遇到 `permission denied for table user_points` 错误，这是因为：
1. 触发器在 `auth` schema 中运行
2. 试图访问 `public` schema 中的 `user_points` 表
3. 权限配置不正确

## 解决方案

### 步骤 1：在 Supabase 控制台执行 SQL
在 Supabase 控制台的 SQL Editor 中执行 `complete_fix_remove_trigger.sql` 文件的内容。

这个脚本会：
- 完全删除有问题的触发器和函数
- 重新创建 `user_points` 表
- 设置正确的权限
- 为现有用户创建积分记录

### 步骤 2：修改钱包登录 API
我已经修改了 `app/api/auth/wallet/route.ts` 文件，在用户创建成功后手动初始化积分记录。

### 步骤 3：验证修复
1. 尝试注册新用户
2. 检查是否还有权限错误
3. 验证积分记录是否正确创建

## 关键改进

1. **移除触发器**：完全删除有问题的触发器，避免权限冲突
2. **手动初始化**：在 API 代码中手动创建积分记录
3. **错误处理**：即使积分初始化失败，也不会中断用户注册
4. **权限设置**：明确授予所有必要的权限

## 执行顺序

1. 先执行 `complete_fix_remove_trigger.sql`
2. 代码修改已经完成
3. 测试用户注册功能

这样应该能彻底解决权限问题。 