"use client"

import { Dashboard } from "@/components/ui/dashboard"
import { ChatbotUIContext } from "@/context/context"
import { getAssistantWorkspacesByWorkspaceId } from "@/db/assistants"
import { getChatsByWorkspaceId } from "@/db/chats"
import { getCollectionWorkspacesByWorkspaceId } from "@/db/collections"
import { getFileWorkspacesByWorkspaceId } from "@/db/files"
import { getFoldersByWorkspaceId } from "@/db/folders"
import { getModelWorkspacesByWorkspaceId } from "@/db/models"
import { getPresetWorkspacesByWorkspaceId } from "@/db/presets"
import { getPromptWorkspacesByWorkspaceId } from "@/db/prompts"
import { getAssistantImageFromStorage } from "@/db/storage/assistant-images"
import { getToolWorkspacesByWorkspaceId } from "@/db/tools"
import { getWorkspaceById } from "@/db/workspaces"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import { supabase } from "@/lib/supabase/browser-client"
import { LLMID } from "@/types"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ReactNode, useContext, useEffect, useState, useRef } from "react"
import Loading from "../loading"

interface WorkspaceLayoutProps {
  children: ReactNode
}

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const router = useRouter()

  const params = useParams()
  const searchParams = useSearchParams()
  const workspaceId = params.workspaceid as string

  const {
    setChatSettings,
    setAssistants,
    setAssistantImages,
    setChats,
    setCollections,
    setFolders,
    setFiles,
    setPresets,
    setPrompts,
    setTools,
    setModels,
    selectedWorkspace,
    setSelectedWorkspace,
    setSelectedChat,
    setChatMessages,
    setUserInput,
    setIsGenerating,
    setFirstTokenReceived,
    setChatFiles,
    setChatImages,
    setNewMessageFiles,
    setNewMessageImages,
    setShowFilesDisplay
  } = useContext(ChatbotUIContext)

  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const dataLoadedRef = useRef(false)

  useEffect(() => {
    ;(async () => {
      const session = (await supabase.auth.getSession()).data.session

      if (session) {
        setIsAuthenticated(true)
        if (!dataLoadedRef.current) {
          await fetchWorkspaceData(workspaceId)
          dataLoadedRef.current = true
        }
      } else {
        // 未登录用户也可以访问，但不会加载工作空间数据
        setLoading(false)
      }
    })()

    // 监听认证状态变化 - 只处理真正的登出事件
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // 只处理登出事件，忽略标签页切换时的 SIGNED_IN 事件
      if (event === "SIGNED_OUT") {
        console.log("User signed out, clearing workspace data...")
        setIsAuthenticated(false)
        dataLoadedRef.current = false
        setLoading(false)
        // 清除工作空间相关数据
        setSelectedWorkspace(null)
        setAssistants([])
        setAssistantImages([])
        setChats([])
        setCollections([])
        setFolders([])
        setFiles([])
        setPresets([])
        setPrompts([])
        setTools([])
        setModels([])
      }
      // 移除对 SIGNED_IN 事件的处理，避免标签页切换时重复加载数据
    })

    return () => subscription.unsubscribe()
  }, [workspaceId])

  // 当workspaceId变化时，重置数据加载状态并清理临时状态
  useEffect(() => {
    dataLoadedRef.current = false
    setUserInput("")
    setChatMessages([])
    setSelectedChat(null)
    setIsGenerating(false)
    setFirstTokenReceived(false)
    setChatFiles([])
    setChatImages([])
    setNewMessageFiles([])
    setNewMessageImages([])
    setShowFilesDisplay(false)
  }, [workspaceId])

  const fetchWorkspaceData = async (workspaceId: string) => {
    setLoading(true)

    try {
      const workspace = await getWorkspaceById(workspaceId)
      if (!workspace) {
        console.error("Workspace not found:", workspaceId)
        setLoading(false)
        return
      }
      setSelectedWorkspace(workspace)

      const assistantData =
        await getAssistantWorkspacesByWorkspaceId(workspaceId)
      setAssistants(assistantData.assistants)

      for (const assistant of assistantData.assistants) {
        let url = ""

        if (assistant.image_path) {
          url = (await getAssistantImageFromStorage(assistant.image_path)) || ""
        }

        if (url) {
          try {
            const response = await fetch(url)
            const blob = await response.blob()
            const base64 = await convertBlobToBase64(blob)

            setAssistantImages(prev => [
              ...prev,
              {
                assistantId: assistant.id,
                path: assistant.image_path,
                base64,
                url
              }
            ])
          } catch (imageError) {
            console.error("Error loading assistant image:", imageError)
            setAssistantImages(prev => [
              ...prev,
              {
                assistantId: assistant.id,
                path: assistant.image_path,
                base64: "",
                url: ""
              }
            ])
          }
        } else {
          setAssistantImages(prev => [
            ...prev,
            {
              assistantId: assistant.id,
              path: assistant.image_path,
              base64: "",
              url
            }
          ])
        }
      }

      const chats = await getChatsByWorkspaceId(workspaceId)
      setChats(chats)

      const collectionData =
        await getCollectionWorkspacesByWorkspaceId(workspaceId)
      setCollections(collectionData.collections)

      const folders = await getFoldersByWorkspaceId(workspaceId)
      setFolders(folders)

      const fileData = await getFileWorkspacesByWorkspaceId(workspaceId)
      setFiles(fileData.files)

      const presetData = await getPresetWorkspacesByWorkspaceId(workspaceId)
      setPresets(presetData.presets)

      const promptData = await getPromptWorkspacesByWorkspaceId(workspaceId)
      setPrompts(promptData.prompts)

      const toolData = await getToolWorkspacesByWorkspaceId(workspaceId)
      setTools(toolData.tools)

      const modelData = await getModelWorkspacesByWorkspaceId(workspaceId)
      setModels(modelData.models)

      setChatSettings({
        model: (searchParams.get("model") ||
          workspace?.default_model ||
          "gpt-4-1106-preview") as LLMID,
        prompt:
          "You are AgentNet — a unified settlement and coordination layer for AI Agents. I help bridge the gaps between different models and systems, enabling secure, efficient, and trustworthy collaboration across intelligent services.",
        temperature: workspace?.default_temperature || 0.5,
        contextLength: workspace?.default_context_length || 4096,
        includeProfileContext: workspace?.include_profile_context || true,
        includeWorkspaceInstructions:
          workspace?.include_workspace_instructions || true,
        embeddingsProvider:
          (workspace?.embeddings_provider as "openai" | "local") || "openai"
      })
    } catch (error: any) {
      console.error("Error fetching workspace data:", error)

      // 检查是否是认证错误
      if (
        error?.status === 401 ||
        error?.message?.includes("JWT") ||
        error?.message?.includes("refresh_token")
      ) {
        console.log("Authentication error detected, redirecting to login...")
        await supabase.auth.signOut()
        router.push("/login")
        return
      }

      // 其他错误，显示错误信息但继续加载
      console.error("Workspace data fetch failed:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <Loading />
  }

  return <Dashboard>{children}</Dashboard>
}
