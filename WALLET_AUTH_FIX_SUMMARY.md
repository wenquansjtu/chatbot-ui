# 钱包登录修复总结

## 问题分析

用户遇到 `invalid_credentials` 错误，原因是：

1. **凭据不匹配**：后端 API 创建用户时使用动态生成的邮箱和密码，但前端尝试使用固定格式登录
2. **权限问题**：`user_points` 表的触发器权限配置不正确
3. **表结构问题**：profiles 表缺少必要的字段

## 修复方案

### 1. 数据库修复
执行 `fix_wallet_auth_complete.sql` 脚本：
- 重新创建 `user_points` 表并设置正确权限
- 确保 `wallet_address` 字段存在
- 删除有问题的触发器
- 为现有用户创建积分记录

### 2. 后端 API 修复 (`app/api/auth/wallet/route.ts`)
- 使用固定的邮箱格式：`${address}@wallet.local`
- 使用固定的密码格式：`${address}_WALLET_2024`
- 返回登录凭据给前端
- 利用现有的触发器自动创建 profile 和 workspace

### 3. 前端修复
- **登录页面** (`app/[locale]/login/page.tsx`)：使用 API 返回的凭据登录
- **用户登录组件** (`components/utility/user-login.tsx`)：使用 API 返回的凭据登录

## 关键改进

1. **凭据一致性**：前后端使用相同的邮箱和密码格式
2. **权限修复**：移除有问题的触发器，手动处理积分初始化
3. **错误处理**：即使积分初始化失败，也不会中断用户注册
4. **用户体验**：新用户和现有用户都能正常登录

## 测试步骤

1. 执行 `fix_wallet_auth_complete.sql` 脚本
2. 测试新用户钱包登录
3. 测试现有用户钱包登录
4. 验证积分记录是否正确创建

## 预期结果

- 钱包登录不再报 `invalid_credentials` 错误
- 新用户注册成功并自动创建积分记录
- 现有用户能正常登录
- 所有相关表（profiles, workspaces, user_points）都正确创建 