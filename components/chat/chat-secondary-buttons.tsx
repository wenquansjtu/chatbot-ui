import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { IconShare } from "@tabler/icons-react"
import { FC, useContext, useState } from "react"
import { WithTooltip } from "../ui/with-tooltip"
import { ChatShareDialog } from "./chat-share-dialog"
import { Tables } from "@/supabase/types"
import { UserLogin } from "../utility/user-login"
import { PointsDisplay } from "../utility/points-display"

interface ChatSecondaryButtonsProps {}

export const ChatSecondaryButtons: FC<ChatSecondaryButtonsProps> = ({}) => {
  const { selectedChat, chatMessages } = useContext(ChatbotUIContext)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<
    Tables<"messages"> | undefined
  >()

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
      {/* 分享按钮 - 只在有助手消息时显示 */}
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

      {/* 积分显示组件 */}
      <PointsDisplay />

      {/* 用户登录组件 */}
      <UserLogin />

      {/* 分享对话框 */}
      <ChatShareDialog
        isOpen={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        selectedMessage={selectedMessage}
      />
    </>
  )
}
