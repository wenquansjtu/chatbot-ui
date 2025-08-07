"use client"

import { Tables } from "@/supabase/types"
import { usePointsRefresh } from "@/lib/hooks/use-points-refresh"
import { IconDownload, IconShare, IconX } from "@tabler/icons-react"
import { ChatbotUIContext } from "@/context/context"
import { FC, useEffect, useState, useRef, useContext } from "react"
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
  const { triggerPointsRefresh } = useContext(ChatbotUIContext) // 使用全局刷新函数
  const { refreshPointsAndNotify } = usePointsRefresh({
    onPointsUpdate: triggerPointsRefresh // 传入全局刷新函数
  })
  const [generatedImage, setGeneratedImage] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  // 在组件顶部添加弹窗引用
  const authWindowRef = useRef<Window | null>(null)

  // 生成分享图片的函数 - 修改为使用静态图片
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

  // 执行分享的函数
  const performShare = async (): Promise<boolean> => {
    if (!generatedImage) {
      toast.error("图片还未生成完成，请稍等")
      return false
    }

    setIsSharing(true)

    try {
      const text =
        "Check out my conversation with AgentNet! 🤖✨ https://test.agentnet.me/"

      const response = await fetch("/api/share/twitter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageData: generatedImage,
          text: text,
          messageId: selectedMessage?.id || "general-share"
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast.success(
          `成功分享到您的Twitter账号！获得 ${result.pointsEarned} 积分！🎉`
        )
        await refreshPointsAndNotify()
        window.open(result.tweetUrl, "_blank")
        return true
      } else {
        throw new Error(result.error || "分享失败")
      }
    } catch (error) {
      console.error("分享失败:", error)
      toast.error("分享失败，请稍后重试")
      return false
    } finally {
      setIsSharing(false)
    }
  }

  // 修改shareToTwitter函数
  const shareToTwitter = async () => {
    console.log("shareToTwitter called", {
      generatedImage: !!generatedImage,
      selectedMessage: !!selectedMessage,
      generatedImageLength: generatedImage?.length,
      selectedMessageId: selectedMessage?.id
    })

    if (!generatedImage) {
      console.log("No generated image available")
      toast.error("图片还未生成完成，请稍等")
      return
    }

    const text =
      "Check out my conversation with AgentNet! 🤖✨ https://test.agentnet.me/"

    try {
      const response = await fetch("/api/share/twitter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageData: generatedImage,
          text: text,
          messageId: selectedMessage?.id || "general-share"
        })
      })

      const result = await response.json()

      if (response.status === 401 && result.needsAuth) {
        // 需要Twitter授权
        toast.info("需要连接您的Twitter账号才能分享")

        // 关闭之前的弹窗（如果存在）
        if (authWindowRef.current && !authWindowRef.current.closed) {
          authWindowRef.current.close()
        }

        // 打开新的授权窗口
        authWindowRef.current = window.open(
          result.authUrl,
          "twitter-auth",
          "width=600,height=600,scrollbars=yes,resizable=yes"
        )

        // 监听弹窗关闭（用户手动关闭的情况）
        const checkClosed = setInterval(() => {
          if (authWindowRef.current?.closed) {
            clearInterval(checkClosed)
            console.log("认证窗口被用户关闭")
          }
        }, 1000)

        return
      }

      if (response.ok && result.success) {
        toast.success(
          `成功分享到您的Twitter账号！获得 ${result.pointsEarned} 积分！🎉`
        )
        await refreshPointsAndNotify()
        window.open(result.tweetUrl, "_blank")

        // 分享成功后关闭对话框
        setTimeout(() => {
          onOpenChange(false)
        }, 2000)
      } else {
        throw new Error(result.error || "分享失败")
      }
    } catch (error) {
      console.error("分享失败:", error)
      toast.error("分享失败，请稍后重试")
    }
  }

  // 监听Twitter认证消息（保持现有的useEffect不变）
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // 验证消息来源
      if (event.origin !== window.location.origin) {
        return
      }

      if (event.data.type === "TWITTER_AUTH_SUCCESS") {
        console.log("Twitter认证成功，开始自动分享")
        toast.success(`Twitter账号连接成功！正在分享...`)

        // 关闭认证窗口
        if (authWindowRef.current && !authWindowRef.current.closed) {
          authWindowRef.current.close()
        }

        // 等待一小段时间确保数据库更新完成
        setTimeout(async () => {
          const success = await performShare()
          if (success) {
            // 分享成功后关闭对话框
            setTimeout(() => {
              onOpenChange(false)
            }, 2000)
          }
        }, 1000)
      } else if (event.data.type === "TWITTER_AUTH_FAILED") {
        console.log("Twitter认证失败")
        toast.error("Twitter账号连接失败，请重试")

        // 关闭认证窗口
        if (authWindowRef.current && !authWindowRef.current.closed) {
          authWindowRef.current.close()
        }
      }
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
      // 清理：组件卸载时关闭弹窗
      if (authWindowRef.current && !authWindowRef.current.closed) {
        authWindowRef.current.close()
      }
    }
  }, [generatedImage, selectedMessage, onOpenChange])

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

  // 清理授权窗口
  useEffect(() => {
    return () => {
      if (authWindowRef.current && !authWindowRef.current.closed) {
        authWindowRef.current.close()
      }
    }
  }, [])

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
                  disabled={isSharing}
                >
                  <IconShare className="size-4" />
                  {isSharing ? "Sharing..." : "Share to X"}
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
