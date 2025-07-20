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
import { ethers } from "ethers"
import { toast } from "sonner"

interface GlobalStateProps {
  children: React.ReactNode
}

export const GlobalState: FC<GlobalStateProps> = ({ children }) => {
  const router = useRouter()

  // PROFILE STORE
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null)

  // 添加MetaMask账户状态
  const [currentMetaMaskAccount, setCurrentMetaMaskAccount] = useState<
    string | null
  >(null)

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
    model: "gpt-4-turbo-preview",
    prompt:
      "You are AgentNet — a unified settlement and coordination layer for AI Agents. I help bridge the gaps between different models and systems, enabling secure, efficient, and trustworthy collaboration across intelligent services.",
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

        // 设置当前MetaMask账户
        if (profile.wallet_address) {
          setCurrentMetaMaskAccount(profile.wallet_address.toLowerCase())
        }

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

  // 清除所有状态的函数
  const clearAllStates = () => {
    // PROFILE STORE
    setProfile(null)
    setCurrentMetaMaskAccount(null)

    // ITEMS STORE
    setAssistants([])
    setCollections([])
    setChats([])
    setFiles([])
    setFolders([])
    setModels([])
    setPresets([])
    setPrompts([])
    setTools([])
    setWorkspaces([])

    // MODELS STORE
    setEnvKeyMap({})
    setAvailableHostedModels([])
    setAvailableLocalModels([])
    setAvailableOpenRouterModels([])

    // WORKSPACE STORE
    setSelectedWorkspace(null)
    setWorkspaceImages([])

    // PRESET STORE
    setSelectedPreset(null)

    // ASSISTANT STORE
    setSelectedAssistant(null)
    setAssistantImages([])
    setOpenaiAssistants([])

    // PASSIVE CHAT STORE
    setUserInput("")
    setChatMessages([])
    setSelectedChat(null)
    setChatFileItems([])

    // ACTIVE CHAT STORE
    setIsGenerating(false)
    setFirstTokenReceived(false)
    setAbortController(null)

    // CHAT INPUT COMMAND STORE
    setIsPromptPickerOpen(false)
    setSlashCommand("")
    setIsFilePickerOpen(false)
    setHashtagCommand("")
    setIsToolPickerOpen(false)
    setToolCommand("")
    setFocusPrompt(false)
    setFocusFile(false)
    setFocusTool(false)
    setFocusAssistant(false)
    setAtCommand("")
    setIsAssistantPickerOpen(false)

    // ATTACHMENTS STORE
    setChatFiles([])
    setChatImages([])
    setNewMessageFiles([])
    setNewMessageImages([])
    setShowFilesDisplay(false)

    // RETRIEVAL STORE
    setUseRetrieval(true)
    setSourceCount(4)

    // TOOL STORE
    setSelectedTools([])
    setToolInUse("none")
  }

  // MetaMask账户切换处理函数
  const handleAccountChange = async (accounts: string[]) => {
    console.log("MetaMask accounts changed:", accounts)

    if (accounts.length === 0) {
      // 用户断开连接
      console.log("User disconnected from MetaMask")
      await supabase.auth.signOut()
      router.push("/login")
      return
    }

    const newAccount = accounts[0].toLowerCase()

    if (currentMetaMaskAccount && newAccount !== currentMetaMaskAccount) {
      console.log(
        "Account switched from",
        currentMetaMaskAccount,
        "to",
        newAccount
      )

      // 显示账户切换通知
      toast.info("检测到MetaMask账户切换，正在切换用户...", {
        duration: 2000
      })

      try {
        // 登出当前用户
        await supabase.auth.signOut()

        // 清除所有本地状态
        clearAllStates()

        // 自动使用新账户登录
        await autoLoginWithNewAccount(newAccount)
      } catch (error) {
        console.error("Error handling account change:", error)
        toast.error("账户切换失败，请手动重新登录")
        router.push("/login")
      }
    }
  }

  // 自动使用新账户登录
  const autoLoginWithNewAccount = async (address: string) => {
    try {
      if (typeof window.ethereum === "undefined") {
        router.push("/login")
        return
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()

      // 创建签名消息
      const message = `Welcome to AgentNet! Please sign this message to verify your wallet ownership. Timestamp: ${Date.now()}`

      // 签名消息
      const signature = await signer.signMessage(message)

      // 调用钱包认证API
      const response = await fetch("/api/auth/wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ address, signature, message })
      })

      const data = await response.json()

      if (data.success) {
        // 根据是否为新用户使用不同的登录策略
        if (data.isNewUser) {
          // 新用户，使用API返回的凭据
          const { error } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password
          })

          if (error) {
            throw error
          }
        } else {
          // 现有用户，使用标准钱包凭据
          const { error } = await supabase.auth.signInWithPassword({
            email: `${address.toLowerCase()}@wallet.local`,
            password: address.toLowerCase() + "_WALLET_2024"
          })

          if (error) {
            throw error
          }
        }

        // 等待认证状态更新
        let attempts = 0
        const maxAttempts = 10

        while (attempts < maxAttempts) {
          const session = (await supabase.auth.getSession()).data.session
          if (session) {
            console.log("Auto-login successful, redirecting...")
            toast.success("账户切换成功！正在跳转到聊天页面...")
            router.push(`/${data.workspaceId}/chat`)
            return
          }

          await new Promise(resolve => setTimeout(resolve, 300))
          attempts++
        }

        // 如果等待超时，仍然跳转
        toast.success("账户切换成功！正在跳转到聊天页面...")
        router.push(`/${data.workspaceId}/chat`)
      } else {
        throw new Error(data.error || "Auto-login failed")
      }
    } catch (error) {
      console.error("Auto-login error:", error)
      toast.error("自动登录失败，请手动重新登录")
      router.push("/login")
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
          await handleRefreshTokenError(error, supabase, router)
        }
      } else if (event === "SIGNED_OUT") {
        // 用户登出后清除所有状态
        clearAllStates()
      }
    })

    // 监听MetaMask账户变化
    let metamaskListener: (() => void) | null = null

    if (typeof window !== "undefined" && window.ethereum) {
      metamaskListener = () => {
        window.ethereum.on("accountsChanged", handleAccountChange)
      }
      metamaskListener()
    }

    // 监听页面可见性变化，标签页切换回来时刷新页面
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        window.location.reload()
      }
    }

    // 添加可见性变化监听器
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange)
    }

    return () => {
      subscription.unsubscribe()
      if (metamaskListener && window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountChange)
      }
      // 清理可见性变化监听器
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange)
      }
    }
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
