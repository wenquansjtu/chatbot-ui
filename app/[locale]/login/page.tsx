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
          // New user, create account and login
          const { error: signUpError } = await supabase.auth.signUp({
            email: `${address.toLowerCase()}@wallet.local`,
            password: address.toLowerCase()
          })

          if (signUpError) {
            setMessage("Wallet registration failed: " + signUpError.message)
            return
          }

          // Wait a bit for account creation to complete
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Login user
        const { error } = await supabase.auth.signInWithPassword({
          email: `${address.toLowerCase()}@wallet.local`,
          password: address.toLowerCase()
        })

        if (error) {
          setMessage("Wallet login failed: " + error.message)
          return
        }

        router.push(`/${data.workspaceId}/chat`)
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
