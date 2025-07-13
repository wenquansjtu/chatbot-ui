"use client"

import { supabase } from "@/lib/supabase/browser-client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const checkSessionAndRedirect = async () => {
      const session = (await supabase.auth.getSession()).data.session

      if (session) {
        // 用户已登录，获取默认工作空间并重定向到聊天页面
        const { data: homeWorkspace, error } = await supabase
          .from("workspaces")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("is_home", true)
          .single()

        if (homeWorkspace) {
          router.push(`/${homeWorkspace.id}/chat`)
        } else {
          // 如果没有默认工作空间，重定向到登录页面
          router.push("/login")
        }
      } else {
        // 用户未登录，重定向到登录页面
        router.push("/login")
      }
    }

    checkSessionAndRedirect()
  }, [router])

  // 显示加载状态
  return (
    <div className="flex size-full flex-col items-center justify-center">
      <div className="animate-pulse text-center">Loading...</div>
    </div>
  )
}
