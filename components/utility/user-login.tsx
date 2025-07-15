"use client"

import { ChatbotUIContext } from "@/context/context"
import { supabase } from "@/lib/supabase/browser-client"
import { useRouter } from "next/navigation"
import { useContext, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  IconLogout,
  IconUser,
  IconWallet,
  IconEdit,
  IconCheck,
  IconX
} from "@tabler/icons-react"
import { MetaMaskLogin } from "@/components/auth/metamask-login"
import { Input } from "@/components/ui/input"

interface UserLoginProps {
  className?: string
}

export const UserLogin: React.FC<UserLoginProps> = ({ className }) => {
  const { profile, setProfile } = useContext(ChatbotUIContext)
  const router = useRouter()
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [isEditingName, setIsEditingName] = useState(false)
  const [newDisplayName, setNewDisplayName] = useState("")

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const handleEditName = () => {
    setNewDisplayName(profile?.display_name || "")
    setIsEditingName(true)
  }

  const handleSaveName = async () => {
    if (!profile || !newDisplayName.trim()) return

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: newDisplayName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", profile.user_id)

      if (error) {
        setMessage("Failed to update display name: " + error.message)
        return
      }

      // 更新本地状态
      setProfile({
        ...profile,
        display_name: newDisplayName.trim()
      })

      setIsEditingName(false)
      setMessage("Display name updated successfully!")

      // 清除消息
      setTimeout(() => setMessage(""), 3000)
    } catch (error: any) {
      setMessage("Failed to update display name: " + error.message)
    }
  }

  const handleCancelEdit = () => {
    setIsEditingName(false)
    setNewDisplayName("")
  }

  const handleMetaMaskLogin = async (
    address: string,
    signature: string,
    message: string
  ) => {
    try {
      const response = await fetch("/api/auth/wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ address, signature, message })
      })

      const data = await response.json()

      if (data.success) {
        if (data.isNewUser) {
          // New user, use the credentials returned from the API
          const { error } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password
          })

          if (error) {
            setMessage("Wallet login failed: " + error.message)
            return
          }
        } else {
          // Existing user, login with standard wallet credentials
          const { error } = await supabase.auth.signInWithPassword({
            email: `${address.toLowerCase()}@wallet.local`,
            password: address.toLowerCase() + "_WALLET_2024"
          })

          if (error) {
            setMessage("Wallet login failed: " + error.message)
            return
          }
        }

        setIsLoginOpen(false)
        // 等待一下让 Supabase 状态更新，然后跳转到聊天页面
        setTimeout(() => {
          router.push(`/${data.workspaceId}/chat`)
        }, 500)
      } else {
        setMessage(data.error)
      }
    } catch (error: any) {
      setMessage("Wallet login failed: " + error.message)
    }
  }

  const handleMetaMaskError = (error: string) => {
    setMessage(error)
  }

  // 如果用户已登录，显示用户头像和下拉菜单
  if (profile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative size-8 rounded-full">
            <Avatar className="size-8">
              <AvatarImage
                src={profile.image_path}
                alt={profile.display_name || profile.username}
              />
              <AvatarFallback>
                {profile.display_name?.charAt(0) ||
                  profile.username?.charAt(0) ||
                  "U"}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuItem className="flex flex-col items-start">
            <div className="flex items-center gap-2">
              <IconUser size={16} />
              <span className="font-medium">
                {profile.display_name || profile.username}
              </span>
            </div>
            {profile.wallet_address && (
              <div className="text-muted-foreground mt-1 text-xs">
                {profile.wallet_address.slice(0, 6)}...
                {profile.wallet_address.slice(-4)}
              </div>
            )}
          </DropdownMenuItem>

          {/* 编辑展示名 */}
          <DropdownMenuItem
            onClick={handleEditName}
            className="flex items-center gap-2"
          >
            <IconEdit size={16} />
            <span>Edit Display Name</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleLogout} className="text-red-600">
            <IconLogout className="mr-2 size-4" />
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // 如果用户未登录，显示登录按钮
  return (
    <div className={className}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsLoginOpen(true)}
        className="flex items-center gap-2"
      >
        <IconWallet size={16} />
        Connect Wallet
      </Button>

      {/* 登录对话框 */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background mx-4 w-full max-w-sm rounded-lg border p-6">
            <div className="mb-6 text-center">
              <h2 className="mb-2 text-xl font-bold">Connect Wallet</h2>
              <p className="text-muted-foreground text-sm">
                Connect your MetaMask wallet to continue
              </p>
            </div>

            <div className="mb-4 flex justify-center">
              <MetaMaskLogin
                onLogin={handleMetaMaskLogin}
                onError={handleMetaMaskError}
              />
            </div>

            {message && (
              <p className="mb-4 text-center text-sm text-red-500">{message}</p>
            )}

            <Button
              variant="outline"
              onClick={() => setIsLoginOpen(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* 编辑展示名对话框 */}
      {isEditingName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background mx-4 w-full max-w-sm rounded-lg border p-6">
            <div className="mb-6 text-center">
              <h2 className="mb-2 text-xl font-bold">Edit Display Name</h2>
              <p className="text-muted-foreground text-sm">
                Update your display name
              </p>
            </div>

            <div className="mb-4">
              <Input
                value={newDisplayName}
                onChange={e => setNewDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className="w-full"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    handleSaveName()
                  } else if (e.key === "Escape") {
                    handleCancelEdit()
                  }
                }}
              />
            </div>

            {message && (
              <p className="mb-4 text-center text-sm text-green-500">
                {message}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                className="flex-1"
              >
                <IconX className="mr-2 size-4" />
                Cancel
              </Button>
              <Button
                onClick={handleSaveName}
                className="flex-1"
                disabled={!newDisplayName.trim()}
              >
                <IconCheck className="mr-2 size-4" />
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
