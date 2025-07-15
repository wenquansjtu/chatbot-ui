import { Tables } from "@/supabase/types"
import { LLMID } from "."

export interface ChatSettings {
  model: LLMID
  prompt: string
  temperature: number
  contextLength: number
  includeProfileContext: boolean
  includeWorkspaceInstructions: boolean
  embeddingsProvider: "openai" | "local"
}

export interface ChatPayload {
  chatSettings: ChatSettings
  workspaceInstructions: string
  chatMessages: any[] // Using any[] to be compatible with both ChatMessage and Tables<"messages">
  assistant: Tables<"assistants"> | null
  messageFileItems: Tables<"file_items">[]
  chatFileItems: Tables<"file_items">[]
}

export interface ChatAPIPayload {
  chatSettings: ChatSettings
  messages: Tables<"messages">[]
}
