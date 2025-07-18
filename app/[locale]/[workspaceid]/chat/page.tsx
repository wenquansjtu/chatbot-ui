"use client"

import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatInput } from "@/components/chat/chat-input"
import { ChatUI } from "@/components/chat/chat-ui"
import { Brand } from "@/components/ui/brand"
import { ChatbotUIContext } from "@/context/context"
import useHotkey from "@/lib/hooks/use-hotkey"
import { useTheme } from "next-themes"
import { useContext, useState } from "react"
import { UserLogin } from "@/components/utility/user-login"
import { PointsDisplay } from "@/components/utility/points-display"
import { WithTooltip } from "@/components/ui/with-tooltip"
import { IconShare } from "@tabler/icons-react"
import { ChatShareDialog } from "@/components/chat/chat-share-dialog"
import { Tables } from "@/supabase/types"

export default function ChatPage() {
  useHotkey("o", () => handleNewChat())
  useHotkey("l", () => {
    handleFocusChatInput()
  })

  const { chatMessages } = useContext(ChatbotUIContext)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<
    Tables<"messages"> | undefined
  >()

  const { handleNewChat, handleFocusChatInput } = useChatHandler()

  const { theme } = useTheme()

  // 获取最后一条助手消息
  const getLastAssistantMessage = () => {
    const assistantMessages = chatMessages
      .filter(item => item.message.role === "assistant")
      .sort((a, b) => b.message.sequence_number - a.message.sequence_number)

    return assistantMessages.length > 0
      ? assistantMessages[0].message
      : undefined
  }

  // 处理分享按钮点击
  const handleShareClick = () => {
    const lastMessage = getLastAssistantMessage()
    console.log("Share button clicked", { lastMessage, chatMessages })
    // 如果没有助手消息，使用空消息或默认消息
    setSelectedMessage(lastMessage || undefined)
    setIsShareDialogOpen(true)
  }

  return (
    <>
      {chatMessages.length === 0 ? (
        <div className="relative flex h-full flex-col items-center justify-center">
          <div className="top-50% left-50% -translate-x-50% -translate-y-50% absolute mb-32">
            <Brand theme={theme === "dark" ? "dark" : "light"} />
          </div>

          <div className="top-50% left-50% -translate-x-50% -translate-y-50% absolute mt-20 max-w-2xl px-4 text-center">
            <p className="text-muted-foreground text-lg leading-relaxed">
              Hello, I&apos;m AgentNet — a unified settlement and coordination
              layer for AI Agents. I help bridge the gaps between different
              models and systems, enabling secure, efficient, and trustworthy
              collaboration across intelligent services.
            </p>
          </div>

          <div className="absolute right-2 top-2 flex items-center space-x-2">
            {/* 分享按钮 - 通用功能，登录即可使用 */}
            <WithTooltip
              delayDuration={200}
              display={<div>Share image</div>}
              trigger={
                <div className="mt-1">
                  <IconShare
                    className="cursor-pointer hover:opacity-50"
                    size={24}
                    onClick={handleShareClick}
                  />
                </div>
              }
            />

            <PointsDisplay />
            <UserLogin />
          </div>

          <div className="flex grow flex-col items-center justify-center" />

          <div className="w-full min-w-[300px] items-end px-2 pb-3 pt-0 sm:w-[600px] sm:pb-8 sm:pt-5 md:w-[700px] lg:w-[700px] xl:w-[800px]">
            <ChatInput />
          </div>
        </div>
      ) : (
        <ChatUI />
      )}

      {/* 分享对话框 */}
      <ChatShareDialog
        isOpen={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        selectedMessage={selectedMessage}
      />
    </>
  )
}
