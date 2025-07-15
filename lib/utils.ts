import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(input: string | number | Date): string {
  const date = new Date(input)
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  })
}

export function getMediaTypeFromDataURL(dataURL: string): string | null {
  const matches = dataURL.match(/^data:([A-Za-z-+\/]+);base64/)
  return matches ? matches[1] : null
}

export function getBase64FromDataURL(dataURL: string): string | null {
  const matches = dataURL.match(/^data:[A-Za-z-+\/]+;base64,(.*)$/)
  return matches ? matches[1] : null
}

// Calculate model usage statistics
export const calculateModelUsage = (
  modelId: string,
  inputTokens: number,
  outputTokens: number = 0
) => {
  // Get model pricing from LLM list
  const modelPricing = getModelPricing(modelId)

  if (!modelPricing) {
    return {
      model: modelId,
      tokens: inputTokens + outputTokens,
      cost: 0
    }
  }

  const inputCost = (inputTokens / 1000000) * modelPricing.inputCost
  const outputCost = (outputTokens / 1000000) * modelPricing.outputCost
  const totalCost = inputCost + outputCost

  return {
    model: modelId,
    tokens: inputTokens + outputTokens,
    cost: totalCost
  }
}

// Get model pricing information
const getModelPricing = (modelId: string) => {
  const pricingMap: Record<string, { inputCost: number; outputCost: number }> =
    {
      // OpenAI Models
      "gpt-4o": { inputCost: 1.37, outputCost: 4.11 },
      "gpt-4-turbo-preview": { inputCost: 1.37, outputCost: 4.11 },
      "gpt-4-vision-preview": { inputCost: 1.37, outputCost: 4.11 },
      "gpt-4": { inputCost: 30, outputCost: 60 },
      "gpt-3.5-turbo": { inputCost: 0.5, outputCost: 1.5 },

      // Anthropic Models
      "claude-3-opus-20240229": { inputCost: 15, outputCost: 75 },
      "claude-3-sonnet-20240229": { inputCost: 3, outputCost: 15 },
      "claude-3-haiku-20240307": { inputCost: 0.25, outputCost: 1.25 },
      "claude-3.5-sonnet-20241022": { inputCost: 3, outputCost: 15 },

      // DeepSeek Models
      "deepseek-chat": { inputCost: 0.55, outputCost: 2.19 },
      "deepseek-coder": { inputCost: 0.55, outputCost: 2.19 },

      // Qwen Models
      "qwen2.5-7b-instruct": { inputCost: 0.027, outputCost: 0.082 },
      "qwen2.5-14b-instruct": { inputCost: 0.027, outputCost: 0.082 },
      "qwen2.5-32b-instruct": { inputCost: 0.027, outputCost: 0.082 },
      "qwen2.5-72b-instruct": { inputCost: 0.027, outputCost: 0.082 },

      // Google Models
      "gemini-1.5-pro": { inputCost: 3.5, outputCost: 10.5 },
      "gemini-1.5-flash": { inputCost: 0.175, outputCost: 0.525 },
      "gemini-pro": { inputCost: 0.5, outputCost: 1.5 },

      // Mistral Models
      "mistral-large-latest": { inputCost: 6.9, outputCost: 20.7 },
      "mistral-medium-latest": { inputCost: 2.7, outputCost: 8.1 },
      "mistral-small-latest": { inputCost: 0.14, outputCost: 0.42 },

      // Groq Models
      "llama3-8b-8192": { inputCost: 0.05, outputCost: 0.1 },
      "llama3-70b-8192": { inputCost: 0.59, outputCost: 0.8 },
      "mixtral-8x7b-32768": { inputCost: 0.14, outputCost: 0.6 },
      "gemma-7b-it": { inputCost: 0.1, outputCost: 0.1 },

      // Perplexity Models
      "pplx-7b-online": { inputCost: 0, outputCost: 0 },
      "pplx-70b-online": { inputCost: 0, outputCost: 0 },
      "pplx-7b-chat": { inputCost: 0, outputCost: 0 },
      "pplx-70b-chat": { inputCost: 0, outputCost: 0 }
    }

  return pricingMap[modelId] || null
}

// Generate random model usage for demonstration
export const generateModelUsage = (text: string) => {
  const models = [
    "gpt-4o",
    "claude-3.5-sonnet-20241022",
    "deepseek-chat",
    "qwen2.5-7b-instruct"
  ]

  // Calculate real total tokens based on text length (roughly 0.3 tokens per character)
  const realTotalTokens =
    Math.floor(text.length * 0.3) + Math.floor(Math.random() * 500)

  // Randomly select 1-3 models
  const numModels = Math.floor(Math.random() * 3) + 1
  const selectedModels = models
    .sort(() => 0.5 - Math.random())
    .slice(0, numModels)

  // Randomly distribute tokens among selected models
  const usage = selectedModels.map((modelId, index) => {
    let tokens: number
    if (index === selectedModels.length - 1) {
      // Last model gets remaining tokens
      tokens =
        realTotalTokens -
        selectedModels.slice(0, -1).reduce((sum, _, i) => {
          return (
            sum +
            Math.floor(
              (realTotalTokens / selectedModels.length) *
                (0.5 + Math.random() * 0.5)
            )
          )
        }, 0)
    } else {
      // Random distribution for other models
      tokens = Math.floor(
        (realTotalTokens / selectedModels.length) * (0.5 + Math.random() * 0.5)
      )
    }

    return calculateModelUsage(
      modelId,
      Math.floor(tokens * 0.7),
      Math.floor(tokens * 0.3)
    )
  })

  return usage
}

/**
 * 处理刷新令牌错误
 * @param error 错误对象
 * @param supabase Supabase 客户端实例
 * @param router Next.js 路由器实例
 * @returns 如果是刷新令牌错误返回 true，否则返回 false
 */
export const handleRefreshTokenError = async (
  error: any,
  supabase: any,
  router: any
): Promise<boolean> => {
  const isRefreshTokenError =
    error?.code === "refresh_token_not_found" ||
    error?.message?.includes("Invalid Refresh Token") ||
    error?.status === 400 ||
    error?.message?.includes("JWT") ||
    error?.message?.includes("refresh_token")

  if (isRefreshTokenError) {
    console.log("Invalid refresh token detected, clearing session...")
    try {
      await supabase.auth.signOut()
      router.push("/login")
    } catch (signOutError) {
      console.error("Error during sign out:", signOutError)
    }
    return true
  }

  return false
}
