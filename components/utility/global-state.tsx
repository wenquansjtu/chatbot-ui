// TODO: Separate into multiple contexts, keeping simple for now

"use client"

import { ChatbotUIContext } from "@/context/context"
import { supabase } from "@/lib/supabase/browser-client"
import { handleRefreshTokenError } from "@/lib/utils"
import { getProfileByUserId } from "@/db/profile"
import { getWorkspacesByUserId } from "@/db/workspaces"
import { getWorkspaceImageFromStorage } from "@/db/storage/workspace-images"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import { fetchHostedModels } from "@/lib/models/fetch-models"
import { fetchOpenRouterModels } from "@/lib/models/fetch-models"
import { fetchOllamaModels } from "@/lib/models/fetch-models"
import { VALID_ENV_KEYS } from "@/types/valid-keys"
import { LLM } from "@/types/llms"
import { OpenRouterLLM } from "@/types/llms"
import { ChatSettings } from "@/types/chat"
import { ChatMessage } from "@/types/chat-message"
import { ChatFile } from "@/types/chat-file"
import { MessageImage } from "@/types/images/message-image"
import { WorkspaceImage } from "@/types/images/workspace-image"
import { AssistantImage } from "@/types/images/assistant-image"
import { Tables } from "@/supabase/types"
import { useRouter } from "next/navigation"
import { FC, useEffect, useState } from "react"

interface GlobalStateProps {
  children: React.ReactNode
}

export const GlobalState: FC<GlobalStateProps> = ({ children }) => {
  const router = useRouter()

  // PROFILE STORE
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null)

  // ITEMS STORE
  const [assistants, setAssistants] = useState<Tables<"assistants">[]>([])
  const [collections, setCollections] = useState<Tables<"collections">[]>([])
  const [chats, setChats] = useState<Tables<"chats">[]>([])
  const [files, setFiles] = useState<Tables<"files">[]>([])
  const [folders, setFolders] = useState<Tables<"folders">[]>([])
  const [models, setModels] = useState<Tables<"models">[]>([])
  const [presets, setPresets] = useState<Tables<"presets">[]>([])
  const [prompts, setPrompts] = useState<Tables<"prompts">[]>([])
  const [tools, setTools] = useState<Tables<"tools">[]>([])
  const [workspaces, setWorkspaces] = useState<Tables<"workspaces">[]>([])

  // MODELS STORE
  const [envKeyMap, setEnvKeyMap] = useState<Record<string, VALID_ENV_KEYS>>({})
  const [availableHostedModels, setAvailableHostedModels] = useState<LLM[]>([])
  const [availableLocalModels, setAvailableLocalModels] = useState<LLM[]>([])
  const [availableOpenRouterModels, setAvailableOpenRouterModels] = useState<
    OpenRouterLLM[]
  >([])

  // WORKSPACE STORE
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<Tables<"workspaces"> | null>(null)
  const [workspaceImages, setWorkspaceImages] = useState<WorkspaceImage[]>([])

  // PRESET STORE
  const [selectedPreset, setSelectedPreset] =
    useState<Tables<"presets"> | null>(null)

  // ASSISTANT STORE
  const [selectedAssistant, setSelectedAssistant] =
    useState<Tables<"assistants"> | null>(null)
  const [assistantImages, setAssistantImages] = useState<AssistantImage[]>([])
  const [openaiAssistants, setOpenaiAssistants] = useState<any[]>([])

  // PASSIVE CHAT STORE
  const [userInput, setUserInput] = useState<string>("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatSettings, setChatSettings] = useState<ChatSettings>({
    model: "gpt-4turbo-preview",
    prompt:
      "Hello, I'm AgentNet — a unified settlement and coordination layer for AI Agents. I help bridge the gaps between different models and systems, enabling secure, efficient, and trustworthy collaboration across intelligent services.",
    temperature: 0.5,
    contextLength: 4000,
    includeProfileContext: true,
    includeWorkspaceInstructions: true,
    embeddingsProvider: "openai"
  })
  const [selectedChat, setSelectedChat] = useState<Tables<"chats"> | null>(null)
  const [chatFileItems, setChatFileItems] = useState<Tables<"file_items">[]>([])

  // ACTIVE CHAT STORE
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [firstTokenReceived, setFirstTokenReceived] = useState<boolean>(false)
  const [abortController, setAbortController] =
    useState<AbortController | null>(null)

  // CHAT INPUT COMMAND STORE
  const [isPromptPickerOpen, setIsPromptPickerOpen] = useState(false)
  const [slashCommand, setSlashCommand] = useState("")
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false)
  const [hashtagCommand, setHashtagCommand] = useState("")
  const [isToolPickerOpen, setIsToolPickerOpen] = useState(false)
  const [toolCommand, setToolCommand] = useState("")
  const [focusPrompt, setFocusPrompt] = useState(false)
  const [focusFile, setFocusFile] = useState(false)
  const [focusTool, setFocusTool] = useState(false)
  const [focusAssistant, setFocusAssistant] = useState(false)
  const [atCommand, setAtCommand] = useState("")
  const [isAssistantPickerOpen, setIsAssistantPickerOpen] = useState(false)

  // ATTACHMENTS STORE
  const [chatFiles, setChatFiles] = useState<ChatFile[]>([])
  const [chatImages, setChatImages] = useState<MessageImage[]>([])
  const [newMessageFiles, setNewMessageFiles] = useState<ChatFile[]>([])
  const [newMessageImages, setNewMessageImages] = useState<MessageImage[]>([])
  const [showFilesDisplay, setShowFilesDisplay] = useState<boolean>(false)

  // RETIEVAL STORE
  const [useRetrieval, setUseRetrieval] = useState<boolean>(true)
  const [sourceCount, setSourceCount] = useState<number>(4)

  // TOOL STORE
  const [selectedTools, setSelectedTools] = useState<Tables<"tools">[]>([])
  const [toolInUse, setToolInUse] = useState<string>("none")

  const fetchStartingData = async () => {
    try {
      const session = (await supabase.auth.getSession()).data.session

      if (session) {
        const user = session.user

        const profile = await getProfileByUserId(user.id)
        setProfile(profile)

        // 跳过用户设置过程，直接进入聊天
        // if (!profile.has_onboarded) {
        //   return router.push("/setup")
        // }

        const workspaces = await getWorkspacesByUserId(user.id)
        setWorkspaces(workspaces)

        for (const workspace of workspaces) {
          let workspaceImageUrl = ""

          if (workspace.image_path) {
            workspaceImageUrl =
              (await getWorkspaceImageFromStorage(workspace.image_path)) || ""
          }

          if (workspaceImageUrl) {
            const response = await fetch(workspaceImageUrl)
            const blob = await response.blob()
            const base64 = await convertBlobToBase64(blob)

            setWorkspaceImages(prev => [
              ...prev,
              {
                workspaceId: workspace.id,
                path: workspace.image_path,
                base64: base64,
                url: workspaceImageUrl
              }
            ])
          }
        }

        return profile
      }
    } catch (error: any) {
      console.error("Error in fetchStartingData:", error)

      // 对于新用户，给更多时间让认证状态稳定
      const isNewUserError =
        error?.message?.includes("refresh_token") ||
        error?.code === "refresh_token_not_found" ||
        error?.status === 400

      if (isNewUserError) {
        console.log(
          "Potential new user refresh token error, waiting before clearing session..."
        )

        // 等待一段时间再检查，给新用户更多时间
        await new Promise(resolve => setTimeout(resolve, 2000))

        // 再次检查会话状态
        const session = (await supabase.auth.getSession()).data.session
        if (!session) {
          console.log(
            "Session still invalid after waiting, clearing session..."
          )
          await supabase.auth.signOut()
          router.push("/login")
          return null
        } else {
          console.log("Session became valid after waiting, continuing...")
          // 重新尝试获取数据
          try {
            const profile = await getProfileByUserId(session.user.id)
            setProfile(profile)

            const workspaces = await getWorkspacesByUserId(session.user.id)
            setWorkspaces(workspaces)

            return profile
          } catch (retryError: any) {
            console.error("Error in retry attempt:", retryError)
            // 如果重试仍然失败，则清除会话
            await supabase.auth.signOut()
            router.push("/login")
            return null
          }
        }
      }

      // 使用工具函数处理其他刷新令牌错误
      const isRefreshTokenError = await handleRefreshTokenError(
        error,
        supabase,
        router
      )
      if (isRefreshTokenError) {
        return null
      }

      // 重新抛出其他错误
      throw error
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const profile = await fetchStartingData()

        if (profile) {
          const hostedModelRes = await fetchHostedModels(profile)
          if (!hostedModelRes) return

          setEnvKeyMap(hostedModelRes.envKeyMap)
          setAvailableHostedModels(hostedModelRes.hostedModels)

          if (
            profile["openrouter_api_key"] ||
            hostedModelRes.envKeyMap["openrouter"]
          ) {
            const openRouterModels = await fetchOpenRouterModels()
            if (!openRouterModels) return
            setAvailableOpenRouterModels(openRouterModels)
          }
        }
      } catch (error: any) {
        console.error("Error fetching starting data:", error)

        // 使用工具函数处理刷新令牌错误
        const isRefreshTokenError = await handleRefreshTokenError(
          error,
          supabase,
          router
        )
        if (isRefreshTokenError) {
          return
        }
      }

      if (process.env.NEXT_PUBLIC_OLLAMA_URL) {
        const localModels = await fetchOllamaModels()
        if (!localModels) return
        setAvailableLocalModels(localModels)
      }
    })()

    // 监听认证状态变化
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        try {
          // 用户登录后重新获取数据
          const profile = await fetchStartingData()

          if (profile) {
            const hostedModelRes = await fetchHostedModels(profile)
            if (hostedModelRes) {
              setEnvKeyMap(hostedModelRes.envKeyMap)
              setAvailableHostedModels(hostedModelRes.hostedModels)
            }
          }
        } catch (error: any) {
          console.error("Error in auth state change handler:", error)

          // 使用工具函数处理刷新令牌错误
          await handleRefreshTokenError(error, supabase, router)
        }
      } else if (event === "SIGNED_OUT") {
        // 用户登出后清除状态
        setProfile(null)
        setWorkspaces([])
        setWorkspaceImages([])
      } else if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully")
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <ChatbotUIContext.Provider
      value={{
        // PROFILE STORE
        profile,
        setProfile,

        // ITEMS STORE
        assistants,
        setAssistants,
        collections,
        setCollections,
        chats,
        setChats,
        files,
        setFiles,
        folders,
        setFolders,
        models,
        setModels,
        presets,
        setPresets,
        prompts,
        setPrompts,
        tools,
        setTools,
        workspaces,
        setWorkspaces,

        // MODELS STORE
        envKeyMap,
        setEnvKeyMap,
        availableHostedModels,
        setAvailableHostedModels,
        availableLocalModels,
        setAvailableLocalModels,
        availableOpenRouterModels,
        setAvailableOpenRouterModels,

        // WORKSPACE STORE
        selectedWorkspace,
        setSelectedWorkspace,
        workspaceImages,
        setWorkspaceImages,

        // PRESET STORE
        selectedPreset,
        setSelectedPreset,

        // ASSISTANT STORE
        selectedAssistant,
        setSelectedAssistant,
        assistantImages,
        setAssistantImages,
        openaiAssistants,
        setOpenaiAssistants,

        // PASSIVE CHAT STORE
        userInput,
        setUserInput,
        chatMessages,
        setChatMessages,
        chatSettings,
        setChatSettings,
        selectedChat,
        setSelectedChat,
        chatFileItems,
        setChatFileItems,

        // ACTIVE CHAT STORE
        isGenerating,
        setIsGenerating,
        firstTokenReceived,
        setFirstTokenReceived,
        abortController,
        setAbortController,

        // CHAT INPUT COMMAND STORE
        isPromptPickerOpen,
        setIsPromptPickerOpen,
        slashCommand,
        setSlashCommand,
        isFilePickerOpen,
        setIsFilePickerOpen,
        hashtagCommand,
        setHashtagCommand,
        isToolPickerOpen,
        setIsToolPickerOpen,
        toolCommand,
        setToolCommand,
        focusPrompt,
        setFocusPrompt,
        focusFile,
        setFocusFile,
        focusTool,
        setFocusTool,
        focusAssistant,
        setFocusAssistant,
        atCommand,
        setAtCommand,
        isAssistantPickerOpen,
        setIsAssistantPickerOpen,

        // ATTACHMENT STORE
        chatFiles,
        setChatFiles,
        chatImages,
        setChatImages,
        newMessageFiles,
        setNewMessageFiles,
        newMessageImages,
        setNewMessageImages,
        showFilesDisplay,
        setShowFilesDisplay,

        // RETRIEVAL STORE
        useRetrieval,
        setUseRetrieval,
        sourceCount,
        setSourceCount,

        // TOOL STORE
        selectedTools,
        setSelectedTools,
        toolInUse,
        setToolInUse
      }}
    >
      {children}
    </ChatbotUIContext.Provider>
  )
}
