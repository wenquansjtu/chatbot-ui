# 网页搜索功能配置指南

## 概述

本项目已集成真实的网页搜索功能，支持 GPT-4 Turbo 模型在对话中自动触发网页搜索来获取最新信息。

## 配置步骤

### 1. 获取 SerpAPI 密钥

1. 访问 [SerpAPI 官网](https://serpapi.com/)
2. 点击 "Sign Up" 注册免费账户
3. 登录后在 Dashboard 中找到你的 API Key
4. 免费账户每月提供 100 次搜索额度

### 2. 配置环境变量

1. 复制 `.env.local.example` 文件为 `.env.local`：
   ```bash
   cp .env.local.example .env.local
   ```

2. 在 `.env.local` 文件中添加你的 SerpAPI 密钥：
   ```
   SERPAPI_API_KEY=your_actual_api_key_here
   ```

3. 重启开发服务器：
   ```bash
   npm run dev
   ```

### 3. 测试功能

1. 打开聊天界面
2. 选择 "GPT-4 Turbo" 模型
3. 询问需要实时信息的问题，例如：
   - "今天的天气怎么样？"
   - "最新的科技新闻"
   - "比特币当前价格"

## 工作原理

- 系统会自动检测用户消息中的关键词（如：今天、最新、当前、现在等）
- 如果检测到需要实时信息，会自动调用 SerpAPI 进行搜索
- 搜索结果会作为上下文注入到 AI 的回答中
- 只有支持网搜的模型（如 GPT-4 Turbo）才会触发此功能

## 注意事项

- 免费账户有搜索次数限制，请合理使用
- 如果没有配置 API 密钥，系统会返回详细的配置说明
- 网搜功能仅在 GPT-4 Turbo 等支持的模型中启用

## 故障排除

如果网搜功能不工作，请检查：

1. `.env.local` 文件中的 `SERPAPI_API_KEY` 是否正确配置
2. 开发服务器是否已重启
3. 使用的是否为支持网搜的模型（GPT-4 Turbo）
4. API 密钥是否有效且未超出使用限制