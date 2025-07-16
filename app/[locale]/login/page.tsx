"use client"

import { Brand } from "@/components/ui/brand"
import { MetaMaskLogin } from "@/components/auth/metamask-login"
import { supabase } from "@/lib/supabase/browser-client"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const checkSession = async () => {
      const session = (await supabase.auth.getSession()).data.session

      if (session) {
        const { data: homeWorkspace, error } = await supabase
          .from("workspaces")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("is_home", true)
          .single()

        if (!homeWorkspace) {
          throw new Error(error?.message || "Unable to find workspace")
        }

        router.push(`/${homeWorkspace.id}/chat`)
      } else {
        setLoading(false)
      }
    }

    checkSession()

    // Show error message
    const errorMessage = searchParams.get("message")
    if (errorMessage) {
      setMessage(errorMessage)
    }
  }, [router, searchParams])

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
          console.log("New user detected, attempting login...")

          // 为新用户添加重试机制
          let loginSuccess = false
          let attempts = 0
          const maxAttempts = 3

          while (!loginSuccess && attempts < maxAttempts) {
            try {
              const { error } = await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password
              })

              if (error) {
                console.log(
                  `Login attempt ${attempts + 1} failed:`,
                  error.message
                )

                // 如果是刷新令牌错误，等待更长时间
                if (
                  error.message.includes("refresh_token") ||
                  error.code === "refresh_token_not_found"
                ) {
                  console.log("Refresh token error detected, waiting longer...")
                  await new Promise(resolve => setTimeout(resolve, 1000))
                } else {
                  await new Promise(resolve => setTimeout(resolve, 500))
                }

                attempts++
              } else {
                loginSuccess = true
                console.log("New user login successful")
              }
            } catch (loginError: any) {
              console.log(
                `Login attempt ${attempts + 1} error:`,
                loginError.message
              )
              await new Promise(resolve => setTimeout(resolve, 500))
              attempts++
            }
          }

          if (!loginSuccess) {
            setMessage(
              "Login failed after multiple attempts. Please try again."
            )
            return
          }
        } else {
          // Existing user, login with standard wallet credentials
          console.log("Existing user detected, attempting login...")

          const { error } = await supabase.auth.signInWithPassword({
            email: `${address.toLowerCase()}@wallet.local`,
            password: address.toLowerCase() + "_WALLET_2024"
          })

          if (error) {
            console.error("Existing user login error:", error)
            setMessage("Wallet login failed: " + error.message)
            return
          }
        }

        // 等待认证状态更新完成后再跳转
        const waitForAuthUpdate = async () => {
          let attempts = 0
          const maxAttempts = 15 // 增加最大尝试次数

          while (attempts < maxAttempts) {
            try {
              const session = (await supabase.auth.getSession()).data.session
              if (session) {
                console.log("Authentication confirmed, redirecting...")
                router.push(`/${data.workspaceId}/chat`)
                return
              }

              console.log(`Waiting for auth update... attempt ${attempts + 1}`)
              await new Promise(resolve => setTimeout(resolve, 300)) // 增加等待时间
              attempts++
            } catch (sessionError: any) {
              console.log(`Session check error:`, sessionError.message)
              await new Promise(resolve => setTimeout(resolve, 300))
              attempts++
            }
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
      console.error("Wallet login error:", error)
      setMessage("Wallet login failed: " + error.message)
    }
  }

  const handleMetaMaskError = (error: string) => {
    setMessage(error)
  }

  if (loading) {
    return (
      <div className="flex w-full flex-1 flex-col justify-center gap-2 px-8 sm:max-w-md">
        <div className="animate-pulse text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-1 flex-col justify-center gap-2 px-8 sm:max-w-md">
      <div className="animate-in text-foreground flex w-full flex-1 flex-col justify-center gap-2">
        <Brand />

        <div className="mt-8 text-center">
          <h1 className="mb-4 text-2xl font-bold">Welcome to AgentNet</h1>
          <p className="text-muted-foreground mb-8">
            Connect your wallet to start chatting with AI agents
          </p>
        </div>

        <div className="flex justify-center">
          <MetaMaskLogin
            onLogin={handleMetaMaskLogin}
            onError={handleMetaMaskError}
          />
        </div>

        {message && (
          <p className="bg-foreground/10 text-foreground mt-4 rounded p-4 text-center">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
