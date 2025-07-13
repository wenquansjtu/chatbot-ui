"use client"

import { Brand } from "@/components/ui/brand"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"
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

  const handleSignIn = async (formData: FormData) => {
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setMessage(error.message)
      return
    }

    const { data: homeWorkspace, error: homeWorkspaceError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", data.user.id)
      .eq("is_home", true)
      .single()

    if (!homeWorkspace) {
      setMessage(homeWorkspaceError?.message || "An unexpected error occurred")
      return
    }

    router.push(`/${homeWorkspace.id}/chat`)
  }

  const handleSignUp = async (formData: FormData) => {
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const { error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      setMessage(error.message)
      return
    }

    router.push("/setup")
  }

  const handleResetPassword = async (formData: FormData) => {
    const email = formData.get("email") as string

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/login/password`
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage("Check email to reset password")
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
      <form
        className="animate-in text-foreground flex w-full flex-1 flex-col justify-center gap-2"
        action={handleSignIn}
      >
        <Brand />

        <Label className="text-md mt-4" htmlFor="email">
          Email
        </Label>
        <Input
          className="mb-3 rounded-md border bg-inherit px-4 py-2"
          name="email"
          placeholder="you@example.com"
          required
        />

        <Label className="text-md" htmlFor="password">
          Password
        </Label>
        <Input
          className="mb-6 rounded-md border bg-inherit px-4 py-2"
          type="password"
          name="password"
          placeholder="••••••••"
        />

        <SubmitButton className="mb-2 rounded-md bg-blue-700 px-4 py-2 text-white">
          Login
        </SubmitButton>

        <SubmitButton
          formAction={handleSignUp}
          className="border-foreground/20 mb-2 rounded-md border px-4 py-2"
        >
          Sign Up
        </SubmitButton>

        <div className="text-muted-foreground mt-1 flex justify-center text-sm">
          <span className="mr-1">Forgot your password?</span>
          <button
            formAction={handleResetPassword}
            className="text-primary ml-1 underline hover:opacity-80"
          >
            Reset
          </button>
        </div>

        {message && (
          <p className="bg-foreground/10 text-foreground mt-4 p-4 text-center">
            {message}
          </p>
        )}
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background text-muted-foreground px-2">
              Or continue with
            </span>
          </div>
        </div>

        <div className="mt-6">
          <MetaMaskLogin
            onLogin={handleMetaMaskLogin}
            onError={handleMetaMaskError}
          />
        </div>
      </div>
    </div>
  )
}
