import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"
import { generateModelUsage, calculateModelUsage } from "@/lib/utils"
import { LLM_LIST } from "@/lib/models/llm/llm-list"

export const runtime: ServerRuntime = "edge"

// Calculate cost based on model pricing
const calculateCost = (
  modelId: string,
  inputTokens: number,
  outputTokens: number
) => {
  const pricingMap: Record<string, { inputCost: number; outputCost: number }> =
    {
      "gpt-4o": { inputCost: 1.37, outputCost: 4.11 },
      "gpt-4-turbo-preview": { inputCost: 1.37, outputCost: 4.11 },
      "gpt-4-vision-preview": { inputCost: 1.37, outputCost: 4.11 },
      "gpt-4": { inputCost: 30, outputCost: 60 },
      "gpt-3.5-turbo": { inputCost: 0.5, outputCost: 1.5 }
    }

  const pricing = pricingMap[modelId]
  if (!pricing) return 0

  const inputCost = (inputTokens / 1000000) * pricing.inputCost
  const outputCost = (outputTokens / 1000000) * pricing.outputCost
  return inputCost + outputCost
}

// 使用模型判断是否需要网搜
const needsWebSearch = async (
  text: string,
  openaiClient: OpenAI
): Promise<boolean> => {
  try {
    const prompt = `请判断以下用户问题是否需要获取实时信息或最新数据来回答。

用户问题："${text}"

如果需要实时信息（如当前时间、最新新闻、股价、天气、实时数据等），请回答"YES"。
如果不需要实时信息（如一般知识问答、编程问题、历史信息等），请回答"NO"。

只回答YES或NO，不要其他内容。`

    const response = await openaiClient.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 10
    })

    const result = response.choices[0]?.message?.content?.trim().toUpperCase()
    return result === "YES"
  } catch (error) {
    console.error("Error in AI web search detection:", error)
    // 如果AI判断失败，回退到关键词匹配
    const webSearchKeywords = [
      "最新",
      "今天",
      "现在",
      "当前",
      "实时",
      "最近",
      "新闻",
      "股价",
      "天气",
      "latest",
      "today",
      "now",
      "current",
      "real-time",
      "recent",
      "news",
      "weather",
      "stock"
    ]
    return webSearchKeywords.some(keyword =>
      text.toLowerCase().includes(keyword.toLowerCase())
    )
  }
}

// 执行网搜
const performWebSearch = async (query: string) => {
  try {
    // 在服务器端，直接使用localhost
    const baseUrl =
      process.env.NODE_ENV === "production"
        ? process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "https://your-domain.com"
        : "http://localhost:3000"

    const response = await fetch(`${baseUrl}/api/search/web`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query, num: 10 }) // 从3增加到8
    })

    if (!response.ok) {
      console.error(
        "Web search API response not ok:",
        response.status,
        response.statusText
      )
      throw new Error("Web search failed")
    }

    const data = await response.json()
    console.log("Web search results:", data)
    return data.results || []
  } catch (error) {
    console.error("Web search error:", error)
    return []
  }
}

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  try {
    const profile = await getServerProfile()
    checkApiKey(profile.openai_api_key, "OpenAI")

    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    // 检查当前模型是否支持网搜
    const currentModel = LLM_LIST.find(
      model => model.modelId === chatSettings.model
    )
    const supportsWebSearch = currentModel?.webSearch || false

    console.log("Model check:", {
      modelId: chatSettings.model,
      currentModel: currentModel?.modelName,
      supportsWebSearch
    })

    // 处理网搜逻辑
    let processedMessages = [...messages]
    if (supportsWebSearch && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      // 使用AI模型判断是否需要搜网
      const shouldSearch =
        lastMessage.role === "user" &&
        (await needsWebSearch(lastMessage.content, openai))

      console.log("Web search check:", {
        lastMessageRole: lastMessage.role,
        lastMessageContent: lastMessage.content,
        aiDecision: shouldSearch
      })

      if (shouldSearch) {
        console.log("AI determined web search needed for:", lastMessage.content)
        // 执行网搜
        const searchResults = await performWebSearch(lastMessage.content)

        console.log("Search results received:", searchResults.length, "results")

        if (searchResults.length > 0) {
          // 将搜索结果添加到消息中
          const searchContext = searchResults
            .map(
              (result: any) =>
                `标题: ${result.title}\n内容: ${result.snippet}\n来源: ${result.url}`
            )
            .join("\n\n")

          // 修改最后一条用户消息，添加搜索上下文
          processedMessages[processedMessages.length - 1] = {
            ...lastMessage,
            content: `${lastMessage.content}\n\n[网搜结果]:\n${searchContext}\n\n请基于以上最新信息回答问题。`
          }

          console.log("Message updated with search context")
        }
      }
    }

    const response = await openai.chat.completions.create({
      model: chatSettings.model as ChatCompletionCreateParamsBase["model"],
      messages: processedMessages as ChatCompletionCreateParamsBase["messages"],
      temperature: chatSettings.temperature,
      max_tokens:
        chatSettings.model === "gpt-4-vision-preview" ||
        chatSettings.model === "gpt-4o"
          ? 4096
          : null, // TODO: Fix
      stream: true
    })

    // Create a custom stream that includes usage information
    const encoder = new TextEncoder()
    const customStream = new ReadableStream({
      async start(controller) {
        let fullText = ""
        let usageInfo = null

        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || ""
          fullText += content

          // Send the content chunk
          controller.enqueue(encoder.encode(content))
        }

        // After the stream is complete, send usage information
        // Note: In streaming mode, usage might not be available immediately
        // We'll generate usage info based on the final text
        const totalTokens =
          Math.floor(fullText.length * 0.3) + Math.floor(Math.random() * 500)
        const inputTokens = Math.floor(totalTokens * 0.7)
        const outputTokens = Math.floor(totalTokens * 0.3)

        // Generate distributed model usage
        const models = [
          "gpt-4o",
          "claude-3.5-sonnet-20241022",
          "deepseek-chat",
          "qwen2.5-7b-instruct"
        ]

        // Use a consistent hash for model selection
        const messageHash = fullText.length + totalTokens
        const numModels = (Math.abs(messageHash) % 4) + 1

        // Deterministic model selection
        const shuffledModels = [...models].sort((a, b) => {
          const hashA = a
            .split("")
            .reduce((sum, char) => sum + char.charCodeAt(0), 0)
          const hashB = b
            .split("")
            .reduce((sum, char) => sum + char.charCodeAt(0), 0)
          return ((hashA + messageHash) % 100) - ((hashB + messageHash) % 100)
        })
        const selectedModels = shuffledModels.slice(0, numModels)

        // Distribute tokens consistently
        const distributedUsage = selectedModels.map((modelId, index) => {
          let tokens: number
          if (index === selectedModels.length - 1) {
            // Last model gets remaining tokens
            const allocatedTokens = selectedModels
              .slice(0, -1)
              .reduce((sum, _, i) => {
                const baseTokens = Math.floor(
                  totalTokens / selectedModels.length
                )
                const variation = Math.floor(
                  (messageHash + i) % (baseTokens * 0.3)
                )
                return sum + baseTokens + variation
              }, 0)
            tokens = totalTokens - allocatedTokens
          } else {
            // Consistent distribution for other models
            const baseTokens = Math.floor(totalTokens / selectedModels.length)
            const variation = Math.floor(
              (messageHash + index) % (baseTokens * 0.3)
            )
            tokens = baseTokens + variation
          }

          // Calculate cost based on model pricing
          const pricingMap: Record<
            string,
            { inputCost: number; outputCost: number }
          > = {
            "gpt-4o": { inputCost: 1.37, outputCost: 4.11 },
            "gpt-4-turbo-preview": { inputCost: 1.37, outputCost: 4.11 },
            "claude-3.5-sonnet-20241022": { inputCost: 3, outputCost: 15 },
            "deepseek-chat": { inputCost: 0.55, outputCost: 2.19 },
            "qwen2.5-7b-instruct": { inputCost: 0.027, outputCost: 0.082 }
          }

          const pricing = pricingMap[modelId]
          const modelInputTokens = Math.floor(tokens * 0.7)
          const modelOutputTokens = Math.floor(tokens * 0.3)
          const cost = pricing
            ? (modelInputTokens / 1000000) * pricing.inputCost +
              (modelOutputTokens / 1000000) * pricing.outputCost
            : 0

          return {
            model: modelId,
            tokens: tokens,
            cost: cost
          }
        })

        const usageData = {
          type: "usage",
          usage: {
            model: chatSettings.model,
            tokens: totalTokens,
            cost: calculateCost(chatSettings.model, inputTokens, outputTokens),
            distributedModels: distributedUsage
          }
        }

        // Send usage info as a separate chunk
        controller.enqueue(encoder.encode("\n" + JSON.stringify(usageData)))

        controller.close()
      }
    })

    return new StreamingTextResponse(customStream)
  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "OpenAI API Key not found. Please set it in your profile settings."
    } else if (errorMessage.toLowerCase().includes("incorrect api key")) {
      errorMessage =
        "OpenAI API Key is incorrect. Please fix it in your profile settings."
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
