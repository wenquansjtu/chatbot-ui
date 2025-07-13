"use client"

import { Tables } from "@/supabase/types"
import { IconDownload, IconShare, IconX } from "@tabler/icons-react"
import { FC, useEffect, useState } from "react"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import html2canvas from "html2canvas"
import { toast } from "sonner"

interface ChatShareDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedMessage?: Tables<"messages">
}

// 获取当天使用统计
const getTodayUsageStats = async () => {
  try {
    const response = await fetch("/api/points")
    if (response.ok) {
      const data = await response.json()
      // 这里可以根据实际需求返回使用统计
      return {
        totalCost: Math.random() * 0.1, // 模拟费用
        models: ["GPT-4", "Claude-3", "Gemini Pro"]
      }
    }
  } catch (error) {
    console.error("Error fetching usage stats:", error)
  }

  return {
    totalCost: 0.05,
    models: ["GPT-4", "Claude-3"]
  }
}

export const ChatShareDialog: FC<ChatShareDialogProps> = ({
  isOpen,
  onOpenChange,
  selectedMessage
}) => {
  const [generatedImage, setGeneratedImage] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState(false)

  // 生成分享图片
  const generateShareImage = async () => {
    if (!selectedMessage) return

    setIsGenerating(true)
    try {
      // 获取当天费用统计
      const { totalCost, models } = await getTodayUsageStats()

      // 获取聊天消息容器元素（包含所有消息的区域）
      const messagesContainer = document.querySelector(
        ".flex.size-full.flex-col.overflow-auto.border-b"
      ) as HTMLElement
      if (!messagesContainer) {
        console.error("Messages container not found")
        return
      }

      // 保存原始滚动位置和样式
      const originalScrollTop = messagesContainer.scrollTop
      const originalOverflow = messagesContainer.style.overflow
      const originalHeight = messagesContainer.style.height
      const originalBg = messagesContainer.style.backgroundColor

      // 临时修改样式以确保捕获所有内容
      messagesContainer.style.overflow = "visible"
      messagesContainer.style.height = "auto"
      messagesContainer.style.backgroundColor = "#fff"

      // 滚动到顶部以确保捕获所有内容
      messagesContainer.scrollTop = 0

      // 等待一下让DOM更新
      await new Promise(resolve => setTimeout(resolve, 300))

      // 使用html2canvas生成整个聊天消息区域的截图
      const canvas = await html2canvas(messagesContainer, {
        backgroundColor: null, // 继承容器背景
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        width: messagesContainer.offsetWidth,
        height: messagesContainer.scrollHeight, // 使用scrollHeight来包含所有内容
        scrollX: 0,
        scrollY: 0,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: document.documentElement.offsetHeight,
        foreignObjectRendering: false, // 关闭 foreignObject
        removeContainer: true,
        logging: false,
        ignoreElements: element => {
          // 忽略一些可能干扰截图的元素
          return (
            element.classList.contains("absolute") &&
            (element.classList.contains("left-4") ||
              element.classList.contains("right-4"))
          )
        }
      })

      // 恢复原始样式和滚动位置
      messagesContainer.style.overflow = originalOverflow
      messagesContainer.style.height = originalHeight
      messagesContainer.style.backgroundColor = originalBg
      messagesContainer.scrollTop = originalScrollTop

      // 创建新的canvas来添加费用统计信息
      const finalCanvas = document.createElement("canvas")
      const ctx = finalCanvas.getContext("2d")
      if (!ctx) return

      // 设置最终canvas尺寸（增加底部空间用于统计信息）
      const padding = 40
      const statsHeight = 120
      finalCanvas.width = canvas.width
      finalCanvas.height = canvas.height + statsHeight + padding

      // 设置背景
      ctx.fillStyle = "#1a1a1a"
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height)

      // 绘制原始截图
      ctx.drawImage(canvas, 0, 0)

      // 绘制分隔线
      ctx.strokeStyle = "#333333"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(padding, canvas.height + padding / 2)
      ctx.lineTo(finalCanvas.width - padding, canvas.height + padding / 2)
      ctx.stroke()

      // 绘制费用统计信息
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 24px Arial"
      ctx.textAlign = "center"

      // 修改文本，不显示"and others"
      const modelsText =
        models.length > 2
          ? `${models.slice(0, 2).join(" and ")} and ${models[2]}${models.length > 3 ? ` and ${models.length - 3} more` : ""}`
          : models.join(" and ")

      const statsText = `Today, I used models like ${modelsText} through AgentNet, totaling a consumption of $${totalCost.toFixed(4)} USD.`

      // 文本换行处理
      const maxWidth = finalCanvas.width - 2 * padding
      const words = statsText.split(" ")
      let line = ""
      let y = canvas.height + padding + 30

      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + " "
        const metrics = ctx.measureText(testLine)
        if (metrics.width > maxWidth && i > 0) {
          ctx.fillText(line, finalCanvas.width / 2, y)
          line = words[i] + " "
          y += 30
        } else {
          line = testLine
        }
      }
      ctx.fillText(line, finalCanvas.width / 2, y)

      // 转换为图片URL
      const imageUrl = finalCanvas.toDataURL("image/png")
      setGeneratedImage(imageUrl)
    } catch (error) {
      console.error("Error generating share image:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  // 下载图片
  const downloadImage = () => {
    if (!generatedImage) return

    const link = document.createElement("a")
    link.href = generatedImage
    link.download = `agentnet-chat-${new Date().toISOString().split("T")[0]}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 分享到Twitter
  const shareToTwitter = async () => {
    if (!generatedImage || !selectedMessage) return

    const text = "Check out my conversation with AgentNet! 🤖✨"
    const url = window.location.href
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`

    // 打开Twitter分享页面
    window.open(twitterUrl, "_blank")

    // 奖励积分
    try {
      const response = await fetch("/api/points/share-image-x", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messageId: selectedMessage.id,
          imagePath: selectedMessage.image_paths?.[0] || ""
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // 显示成功提示
          toast.success(`Shared to X! Earned ${data.points_earned} points! 🎉`)
        }
      }
    } catch (error) {
      console.error("Error processing image share bonus:", error)
    }
  }

  // 当对话框打开时生成图片
  useEffect(() => {
    if (isOpen && selectedMessage && !generatedImage) {
      generateShareImage()
    }
  }, [isOpen, selectedMessage])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconShare className="size-5" />
            Share Conversation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isGenerating ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <div className="size-6 animate-spin rounded-full border-b-2 border-blue-500"></div>
                <span>Generating image...</span>
              </div>
            </div>
          ) : generatedImage ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={generatedImage}
                  alt="Chat conversation"
                  className="h-auto max-w-full rounded-lg border"
                />
              </div>

              <div className="flex justify-center gap-2">
                <Button
                  onClick={downloadImage}
                  className="flex items-center gap-2"
                >
                  <IconDownload className="size-4" />
                  Download
                </Button>
                <Button
                  onClick={shareToTwitter}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <IconShare className="size-4" />
                  Share to X
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No image generated
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
