"use client"

import { Tables } from "@/supabase/types"
import {
  IconDownload,
  IconShare,
  IconX,
  IconCopy,
  IconBrandTwitter
} from "@tabler/icons-react"
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
  const [isCopying, setIsCopying] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

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

  // 复制图片到剪贴板
  const copyImageToClipboard = async () => {
    if (!generatedImage) {
      toast.error("没有可复制的图片")
      return
    }

    setIsCopying(true)
    try {
      // 检查浏览器是否支持剪贴板API
      if (!navigator.clipboard || !navigator.clipboard.write) {
        throw new Error("浏览器不支持剪贴板API")
      }

      // 将base64图片转换为blob
      const response = await fetch(generatedImage)
      const blob = await response.blob()

      // 复制到剪贴板
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ])

      toast.success("图片已复制到剪贴板！现在可以粘贴到X上了 📋")
    } catch (error) {
      console.error("Error copying image to clipboard:", error)
      toast.error("复制图片失败，请尝试下载图片后手动上传")
    } finally {
      setIsCopying(false)
    }
  }

  // 分享到Twitter（使用官方API）
  const shareToTwitter = async () => {
    if (!generatedImage || !selectedMessage) {
      toast.error("没有可分享的内容")
      return
    }

    setIsSharing(true)
    try {
      const text = `我在 ${process.env.NEXT_PUBLIC_APP_NAME || "ChatBot UI"} 上进行了一次精彩的对话！🤖✨\n\n#AI #ChatBot #对话`

      // 调用新的Twitter API端点
      const response = await fetch("/api/share/twitter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageData: generatedImage,
          text: text,
          messageId: selectedMessage.id
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast.success(
          `成功分享到X！${result.pointsEarned ? ` 获得 ${result.pointsEarned} 积分！` : ""} 🎉`
        )

        // 打开推文链接
        if (result.tweetUrl) {
          window.open(result.tweetUrl, "_blank")
        }
      } else {
        // 如果API未配置，回退到预览分享方式
        if (result.error === "Twitter API credentials not configured") {
          toast.info("Twitter API未配置，尝试预览分享方式")
          try {
            await shareViaPreview()
            return
          } catch (previewError) {
            console.error("Preview sharing failed:", previewError)
            // 最终回退到手动分享
            await copyImageToClipboard()
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
            window.open(twitterUrl, "_blank")
          }
        } else {
          throw new Error(result.message || result.error || "分享失败")
        }
      }
    } catch (error: any) {
      console.error("Error sharing to Twitter:", error)
      toast.error(error.message || "分享失败，请稍后重试")
    } finally {
      setIsSharing(false)
    }
  }

  // 基于 Open Graph 预览的分享方案
  const shareViaPreview = async () => {
    try {
      const text = `我在 ${process.env.NEXT_PUBLIC_APP_NAME || "ChatBot UI"} 上进行了一次精彩的对话！🤖✨\n\n#AI #ChatBot #对话`

      const response = await fetch("/api/share/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageData: generatedImage,
          text: text,
          messageId: selectedMessage?.id || "unknown"
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // 打开 Twitter 分享页面，使用预览 URL
        window.open(result.twitterShareUrl, "_blank")

        toast.success("预览分享已准备！Twitter 将显示图片预览卡片")
      } else {
        throw new Error(result.error || "预览分享失败")
      }
    } catch (error) {
      console.error("Preview sharing error:", error)
      throw error
    }
  }

  // 使用Web Share API分享（如果支持）
  const shareWithWebAPI = async () => {
    if (!generatedImage || !selectedMessage) {
      toast.error("没有可分享的图片")
      return
    }

    setIsSharing(true)
    try {
      // 将base64图片转换为blob
      const response = await fetch(generatedImage)
      const blob = await response.blob()
      const file = new File([blob], "agentnet-chat.jpg", { type: "image/jpeg" })

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: "AgentNet Chat",
          text: "Check out my conversation with AgentNet! 🤖✨",
          url: window.location.href,
          files: [file]
        })

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
              toast.success(
                `Shared successfully! Earned ${data.points_earned} points! 🎉`
              )
            }
          }
        } catch (error) {
          console.error("Error processing image share bonus:", error)
        }
      } else {
        // 如果不支持Web Share API，回退到复制图片
        await copyImageToClipboard()
        toast.info("请手动将图片粘贴到您想要分享的平台上")
      }
    } catch (error) {
      console.error("Error sharing with Web API:", error)
      toast.error("分享失败，请尝试下载图片后手动分享")
    } finally {
      setIsSharing(false)
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

              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  onClick={downloadImage}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <IconDownload className="size-4" />
                  下载图片
                </Button>
                <Button
                  onClick={copyImageToClipboard}
                  variant="outline"
                  className="flex items-center gap-2"
                  disabled={isCopying || isSharing}
                >
                  <IconCopy className="size-4" />
                  {isCopying ? "复制中..." : "复制图片"}
                </Button>
                <Button
                  onClick={shareToTwitter}
                  className="flex items-center gap-2 bg-black text-white hover:bg-gray-800"
                  disabled={isCopying || isSharing}
                >
                  <IconBrandTwitter className="size-4" />
                  {isSharing ? "分享中..." : "分享到 X"}
                </Button>
                <Button
                  onClick={shareWithWebAPI}
                  variant="outline"
                  className="flex items-center gap-2"
                  disabled={isCopying || isSharing}
                >
                  <IconShare className="size-4" />
                  {isSharing ? "分享中..." : "通用分享"}
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
