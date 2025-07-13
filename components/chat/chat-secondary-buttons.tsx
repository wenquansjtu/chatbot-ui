import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { IconInfoCircle, IconMessagePlus, IconShare } from "@tabler/icons-react"
import { FC, useContext, useState } from "react"
import { WithTooltip } from "../ui/with-tooltip"
import { ChatShareDialog } from "./chat-share-dialog"
import { Tables } from "@/supabase/types"

interface ChatSecondaryButtonsProps {}

export const ChatSecondaryButtons: FC<ChatSecondaryButtonsProps> = ({}) => {
  const { selectedChat, chatMessages } = useContext(ChatbotUIContext)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<
    Tables<"messages"> | undefined
  >()

  const { handleNewChat } = useChatHandler()

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
    if (lastMessage) {
      setSelectedMessage(lastMessage)
      setIsShareDialogOpen(true)
    }
  }

  return (
    <>
      {selectedChat && (
        <>
          <WithTooltip
            delayDuration={200}
            display={
              <div>
                <div className="text-xl font-bold">Chat Info</div>

                <div className="mx-auto mt-2 max-w-xs space-y-2 sm:max-w-sm md:max-w-md lg:max-w-lg">
                  <div>Model: {selectedChat.model}</div>
                  <div>Prompt: {selectedChat.prompt}</div>

                  <div>Temperature: {selectedChat.temperature}</div>
                  <div>Context Length: {selectedChat.context_length}</div>

                  <div>
                    Profile Context:{" "}
                    {selectedChat.include_profile_context
                      ? "Enabled"
                      : "Disabled"}
                  </div>
                  <div>
                    {" "}
                    Workspace Instructions:{" "}
                    {selectedChat.include_workspace_instructions
                      ? "Enabled"
                      : "Disabled"}
                  </div>

                  <div>
                    Embeddings Provider: {selectedChat.embeddings_provider}
                  </div>
                </div>
              </div>
            }
            trigger={
              <div className="mt-1">
                <IconInfoCircle
                  className="cursor-default hover:opacity-50"
                  size={24}
                />
              </div>
            }
          />

          {/* 分享按钮 - 只在有助手消息时显示 */}
          {getLastAssistantMessage() && (
            <WithTooltip
              delayDuration={200}
              display={<div>Share conversation as image</div>}
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
          )}

          <WithTooltip
            delayDuration={200}
            display={<div>Start a new chat</div>}
            trigger={
              <div className="mt-1">
                <IconMessagePlus
                  className="cursor-pointer hover:opacity-50"
                  size={24}
                  onClick={handleNewChat}
                />
              </div>
            }
          />
        </>
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
