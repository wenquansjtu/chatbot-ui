# 积分系统功能说明

## 概述

本项目实现了一个完整的积分系统，用户可以通过多种方式获得积分，用于解锁更多功能。

## 积分规则

### 1. 每日打卡 (Daily Check-in)
- **积分奖励**: 100 分
- **频率**: 每天一次
- **触发方式**: 用户在设置页面点击"Daily Check-in"按钮
- **限制**: 每天只能打卡一次

### 2. 每日第一次对话 (Daily First Conversation)
- **积分奖励**: 100 分
- **频率**: 每天一次
- **触发方式**: 用户每天第一次创建新对话时自动触发
- **限制**: 每天只能获得一次奖励

### 3. 图片分享到X (Share Image to X)
- **积分奖励**: 200 分
- **频率**: 无限制
- **触发方式**: 用户点击分享按钮将对话图片分享到X(Twitter)时
- **限制**: 每次分享都会获得奖励

## 数据库结构

### 主要表

1. **user_points** - 用户积分表
   - `user_id`: 用户ID
   - `points`: 当前积分
   - `created_at`: 创建时间
   - `updated_at`: 更新时间

2. **check_in_records** - 打卡记录表
   - `user_id`: 用户ID
   - `check_in_date`: 打卡日期
   - `points_earned`: 获得的积分
   - `created_at`: 创建时间

3. **daily_first_conversation_records** - 每日第一次对话记录表
   - `user_id`: 用户ID
   - `conversation_date`: 对话日期
   - `points_earned`: 获得的积分
   - `chat_id`: 关联的聊天ID
   - `created_at`: 创建时间

4. **image_share_x_records** - 图片分享到X记录表
   - `user_id`: 用户ID
   - `share_date`: 分享日期
   - `points_earned`: 获得的积分
   - `message_id`: 关联的消息ID
   - `image_path`: 图片路径
   - `created_at`: 创建时间

### 数据库函数

1. **daily_check_in(user_uuid)** - 处理每日打卡
2. **daily_first_conversation_bonus(user_uuid, chat_uuid)** - 处理每日第一次对话奖励
3. **image_share_x_bonus(user_uuid, message_uuid, image_path)** - 处理图片分享到X奖励

## API 端点

### 1. 获取积分信息
- **路径**: `GET /api/points`
- **功能**: 获取用户积分和所有记录
- **返回**: 用户积分、打卡记录、第一次对话记录、图片分享记录

### 2. 每日打卡
- **路径**: `POST /api/points/check-in`
- **功能**: 执行每日打卡
- **返回**: 打卡结果和获得的积分

### 3. 每日第一次对话奖励
- **路径**: `POST /api/points/first-conversation`
- **功能**: 处理每日第一次对话奖励
- **参数**: `chatId` - 聊天ID
- **返回**: 奖励结果和获得的积分

### 4. 图片分享到X奖励
- **路径**: `POST /api/points/share-image-x`
- **功能**: 处理图片分享到X奖励
- **参数**: `messageId` - 消息ID, `imagePath` - 图片路径
- **返回**: 奖励结果和获得的积分

## 前端组件

### 1. CheckInCard 组件
- **位置**: `components/utility/check-in-card.tsx`
- **功能**: 显示用户积分、打卡状态、积分规则说明
- **特性**: 
  - 显示当前积分
  - 显示连续打卡天数
  - 打卡按钮
  - 积分规则说明
  - 最近打卡记录

### 2. ChatShareDialog 组件
- **位置**: `components/chat/chat-share-dialog.tsx`
- **功能**: 分享对话图片到社交媒体
- **特性**:
  - 生成分享图片
  - 分享到X时自动奖励积分
  - 显示成功提示

## 使用流程

### 每日打卡流程
1. 用户进入设置页面
2. 点击"Daily Check-in"按钮
3. 系统检查是否已经打卡
4. 如果未打卡，奖励100积分并更新记录
5. 显示成功提示

### 每日第一次对话流程
1. 用户创建新对话
2. 系统自动检查是否为今天第一次对话
3. 如果是第一次，自动奖励100积分
4. 在控制台输出奖励信息

### 图片分享到X流程
1. 用户点击分享按钮
2. 生成对话图片
3. 用户点击"Share to X"按钮
4. 打开X分享页面
5. 自动奖励200积分
6. 显示成功提示

## 安全特性

1. **行级安全策略 (RLS)**: 所有表都启用了RLS，确保用户只能访问自己的数据
2. **唯一约束**: 防止重复奖励
3. **日期检查**: 确保每日奖励只发放一次
4. **用户验证**: 所有API端点都验证用户身份

## 扩展性

系统设计具有良好的扩展性，可以轻松添加新的积分规则：

1. 创建新的记录表
2. 添加相应的数据库函数
3. 创建API端点
4. 更新前端组件
5. 添加新的积分规则说明

## 部署说明

1. 运行数据库迁移文件：
   ```sql
   -- 运行基础积分系统迁移
   -- supabase/migrations/20241201000001_add_points_system.sql
   
   -- 运行新积分规则迁移
   -- supabase/migrations/20241201000002_add_new_points_rules.sql
   ```

2. 确保所有API端点正常工作
3. 测试各个积分获取功能
4. 验证前端组件显示正确

### 迁移文件说明

- `20241201000001_add_points_system.sql`: 基础积分系统，包含用户积分表和每日打卡功能
- `20241201000003_add_new_points_rules_only.sql`: 新增的积分规则，包含每日第一次对话和图片分享到X功能

### 注意事项

- 确保按顺序运行迁移文件
- 如果遇到策略已存在的错误，说明基础积分系统已经部署，只需要运行第三个迁移文件
- 所有新功能都使用 `IF NOT EXISTS` 和 `CREATE OR REPLACE` 确保安全部署
- 第三个迁移文件使用 `DO $$ BEGIN ... END $$` 块来安全地创建策略，避免冲突

## 注意事项

1. 积分系统依赖于用户认证，确保用户已登录
2. 数据库函数使用事务确保数据一致性
3. 前端组件包含错误处理机制
4. 所有积分操作都有相应的日志记录 