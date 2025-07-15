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
import { IconLogout, IconUser, IconWallet } from "@tabler/icons-react"
import { MetaMaskLogin } from "@/components/auth/metamask-login"

interface UserLoginProps {
  className?: string
}

export const UserLogin: React.FC<UserLoginProps> = ({ className }) => {
  const { profile } = useContext(ChatbotUIContext)
  const router = useRouter()
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [message, setMessage] = useState("")

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
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

        // 等待认证状态更新完成后再跳转
        const waitForAuthUpdate = async () => {
          let attempts = 0
          const maxAttempts = 10

          while (attempts < maxAttempts) {
            const session = (await supabase.auth.getSession()).data.session
            if (session) {
              console.log("Authentication confirmed, redirecting...")
              router.push(`/${data.workspaceId}/chat`)
              return
            }

            console.log(`Waiting for auth update... attempt ${attempts + 1}`)
            await new Promise(resolve => setTimeout(resolve, 200))
            attempts++
          }

          // 如果等待超时，仍然跳转
          console.log("Auth update timeout, redirecting anyway...")
          router.push(`/${data.workspaceId}/chat`)
        }

        waitForAuthUpdate()
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
    </div>
  )
}
