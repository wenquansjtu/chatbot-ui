"use client"

import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatInput } from "@/components/chat/chat-input"
import { ChatUI } from "@/components/chat/chat-ui"
import { Brand } from "@/components/ui/brand"
import { ChatbotUIContext } from "@/context/context"
import useHotkey from "@/lib/hooks/use-hotkey"
import { useTheme } from "next-themes"
import { useContext } from "react"
import { UserLogin } from "@/components/utility/user-login"
import { PointsDisplay } from "@/components/utility/points-display"

export default function ChatPage() {
  useHotkey("o", () => handleNewChat())
  useHotkey("l", () => {
    handleFocusChatInput()
  })

  const { chatMessages } = useContext(ChatbotUIContext)

  const { handleNewChat, handleFocusChatInput } = useChatHandler()

  const { theme } = useTheme()

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
            <PointsDisplay />
            <UserLogin />
            <img
              src="/share.jpg"
              alt="Share AgentNet"
              className="size-8 cursor-pointer rounded hover:opacity-50"
              onClick={async () => {
                // 获取用户总消耗金额
                let totalCost = 0
                try {
                  const response = await fetch("/api/points/total-usage")
                  if (response.ok) {
                    const data = await response.json()
                    totalCost = data.totalCost || 0
                  }
                } catch (error) {
                  console.error("Error fetching total usage:", error)
                }

                const text = `Check out AgentNet — a unified settlement and coordination layer for AI Agents! $${totalCost.toFixed(4)} USD1 🤖✨`
                const url = window.location.href
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
                window.open(twitterUrl, "_blank")
              }}
            />
          </div>

          <div className="flex grow flex-col items-center justify-center" />

          <div className="w-full min-w-[300px] items-end px-2 pb-3 pt-0 sm:w-[600px] sm:pb-8 sm:pt-5 md:w-[700px] lg:w-[700px] xl:w-[800px]">
            <ChatInput />
          </div>
        </div>
      ) : (
        <ChatUI />
      )}
    </>
  )
}
