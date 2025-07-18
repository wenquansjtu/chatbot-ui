"use client"

import { Tables } from "@/supabase/types"
import { IconDownload, IconShare, IconX } from "@tabler/icons-react"
import { FC, useEffect, useState } from "react"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import { toast } from "sonner"

interface ChatShareDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedMessage?: Tables<"messages">
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
    console.log("generateShareImage called", { selectedMessage, isOpen })

    setIsGenerating(true)
    try {
      // 获取用户总消耗金额
      let totalCost = 0
      try {
        const response = await fetch("/api/points/total-usage")
        if (response.ok) {
          const data = await response.json()
          totalCost = data.totalCost || 0
          console.log("Total cost fetched:", totalCost)
        }
      } catch (error) {
        console.error("Error fetching total usage:", error)
      }

      // 创建 canvas 来合成图片和文字
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        console.error("Failed to get canvas context")
        setGeneratedImage("/share.jpg")
        return
      }

      // 加载原始图片
      const img = new Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        console.log("Image loaded successfully", {
          width: img.width,
          height: img.height
        })

        // 设置 canvas 尺寸
        canvas.width = img.width
        canvas.height = img.height

        // 绘制原始图片
        ctx.drawImage(img, 0, 0)

        // 添加文字
        ctx.fillStyle = "#f5b449"
        ctx.font = "bold 64px Arial"
        ctx.textAlign = "left"
        ctx.textBaseline = "top"

        // 设置文字位置为 (64, 464)
        const text = `$${totalCost.toFixed(4)} USD1`
        const x = 64
        const y = 464

        console.log("Drawing text:", { text, x, y, totalCost })

        // 确保文字总是显示，即使 cost 为 0
        if (totalCost === 0) {
          console.log("Total cost is 0, using default text")
        }

        // 绘制文字
        ctx.fillText(text, x, y)

        // 添加文字阴影以提高可读性
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
        ctx.shadowBlur = 4
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2

        // 重新绘制文字（带阴影）
        ctx.fillText(text, x, y)

        // 重置阴影
        ctx.shadowColor = "transparent"
        ctx.shadowBlur = 0
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0

        // 转换为图片URL
        const imageUrl = canvas.toDataURL("image/jpeg", 0.9)
        console.log("Generated image URL:", imageUrl.substring(0, 50) + "...")
        setGeneratedImage(imageUrl)
      }

      img.onerror = error => {
        console.error("Error loading share image:", error)
        // 如果图片加载失败，使用原始图片
        setGeneratedImage("/share.jpg")
      }

      console.log("Loading image from:", "/share.jpg")
      img.src = "/share.jpg"
    } catch (error) {
      console.error("Error generating share image:", error)
      // 出错时使用原始图片
      setGeneratedImage("/share.jpg")
    } finally {
      setIsGenerating(false)
    }
  }

  // 下载图片
  const downloadImage = () => {
    if (!generatedImage) return

    const link = document.createElement("a")
    link.href = generatedImage
    link.download = `agentnet-chat-${new Date().toISOString().split("T")[0]}.jpg`
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
    console.log("useEffect triggered", {
      isOpen,
      selectedMessage,
      generatedImage
    })
    if (isOpen) {
      // 每次打开对话框都重新生成图片
      setGeneratedImage("") // 清空之前的图片
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
              <div className="flex max-h-[70vh] justify-center overflow-auto">
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
