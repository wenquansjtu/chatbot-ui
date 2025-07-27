# Twitter API 集成指南

## 概述

本项目现在支持通过官方 Twitter API 直接发布图文推文，实现了真正的自动化分享功能。按照 X（Twitter）官方推荐的两步 API 流程：

1. **第一步**：使用 Twitter API v1.1 上传图片，获取 `media_id`
2. **第二步**：使用 Twitter API v2 发布推文，附带上传的图片

## 功能特性

### ✅ 自动化图文发布
- 自动上传生成的对话分享图片到 Twitter
- 自动发布推文并附带图片
- 返回推文链接，用户可直接查看发布结果

### ✅ 智能降级机制
- 如果 Twitter API 未配置，自动回退到手动分享模式
- 复制图片到剪贴板，打开 Twitter 分享页面
- 确保功能在任何情况下都可用

### ✅ 积分奖励系统
- 成功分享后自动奖励积分
- 与现有积分系统完全兼容
- 显示获得的积分数量

## 配置步骤

### 1. 获取 Twitter API 凭证

1. 访问 [Twitter Developer Portal](https://developer.twitter.com/)
2. 创建开发者账户（如果还没有）
3. 创建新的应用程序
4. 确保应用具有 **Read and Write** 权限
5. 生成以下凭证：
   - API Key
   - API Secret Key
   - Access Token
   - Access Token Secret

### 2. 配置环境变量

在 `.env.local` 文件中添加以下配置：

```env
# Twitter API credentials for posting tweets with images
TWITTER_API_KEY=your_twitter_api_key_here
TWITTER_API_SECRET=your_twitter_api_secret_here
TWITTER_ACCESS_TOKEN=your_twitter_access_token_here
TWITTER_ACCESS_TOKEN_SECRET=your_twitter_access_token_secret_here
```

### 3. 重启开发服务器

```bash
npm run dev
```

## API 端点

### POST `/api/share/twitter`

**功能**：发布图文推文到 Twitter

**请求参数**：
```json
{
  "imageData": "data:image/jpeg;base64,...",  // base64 图片数据
  "text": "推文文本内容",                    // 推文文本
  "messageId": "message-uuid"               // 消息ID（用于积分奖励）
}
```

**成功响应**：
```json
{
  "success": true,
  "tweetId": "1234567890",
  "tweetUrl": "https://twitter.com/user/status/1234567890",
  "pointsEarned": 200
}
```

**错误响应**：
```json
{
  "error": "Twitter API credentials not configured",
  "message": "请在环境变量中配置Twitter API密钥"
}
```

## 技术实现

### OAuth 1.0a 认证

项目实现了完整的 OAuth 1.0a 签名机制，包括：
- 参数排序和编码
- 签名基字符串构建
- HMAC-SHA1 签名生成
- Authorization 头构建

### 两步 API 调用流程

```typescript
// 1. 上传图片到 Twitter API v1.1
const mediaId = await uploadImageToTwitter(imageData, credentials)

// 2. 发布推文附带图片（Twitter API v2）
const tweetId = await postTweetWithMedia(text, mediaId, credentials)
```

### 错误处理

- 完整的错误捕获和处理
- 详细的错误日志记录
- 用户友好的错误提示
- 自动降级到手动分享模式

## 使用方式

### 用户操作流程

1. 在聊天界面点击分享按钮
2. 生成对话分享图片
3. 点击 "分享到 X" 按钮
4. 系统自动：
   - 上传图片到 Twitter
   - 发布推文附带图片
   - 奖励积分
   - 显示成功提示
   - 打开推文链接

### 降级模式

如果 Twitter API 未配置：
1. 系统提示使用手动分享模式
2. 自动复制图片到剪贴板
3. 打开 Twitter 分享页面
4. 用户手动粘贴图片并发布

## 安全考虑

### 凭证保护
- 所有 Twitter API 凭证存储在服务器端环境变量中
- 客户端无法访问敏感凭证信息
- 使用 OAuth 1.0a 标准认证流程

### 权限控制
- 只有登录用户可以使用分享功能
- 每次请求都验证用户身份
- 防止未授权的 API 调用

## 故障排除

### 常见问题

**Q: 分享失败，提示 "Twitter API credentials not configured"**
A: 请检查 `.env.local` 文件中的 Twitter API 凭证配置是否正确。

**Q: 上传图片失败**
A: 请确认 Twitter 应用具有 Read and Write 权限。

**Q: OAuth 签名验证失败**
A: 请检查 API Key 和 Secret 是否正确，确保时间戳准确。

### 调试信息

开发模式下，控制台会输出详细的调试信息：
- OAuth 参数生成过程
- API 请求和响应详情
- 错误堆栈信息

## 未来改进

### 计划功能
- [ ] 支持视频分享
- [ ] 批量分享多张图片
- [ ] 自定义推文模板
- [ ] 分享统计和分析
- [ ] 支持其他社交媒体平台

### 性能优化
- [ ] 图片压缩和优化
- [ ] API 请求缓存
- [ ] 并发请求限制
- [ ] 重试机制

## 相关文档

- [Twitter API v2 文档](https://developer.twitter.com/en/docs/twitter-api)
- [Twitter API v1.1 媒体上传](https://developer.twitter.com/en/docs/twitter-api/v1/media/upload-media/overview)
- [OAuth 1.0a 规范](https://tools.ietf.org/html/rfc5849)
- [积分系统说明](./POINTS_SYSTEM_README.md)