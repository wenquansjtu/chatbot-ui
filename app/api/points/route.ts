import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getAllPointsData } from "@/db/points"

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // Get current user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 使用新的辅助函数并行获取所有数据
    const data = await getAllPointsData(user.id, 30)

    // 创建响应，添加适当的缓存头
    const response = NextResponse.json(data)

    // 添加缓存头：缓存30秒，允许过期缓存但会在后台重新验证
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=30, stale-while-revalidate=60"
    )

    return response
  } catch (error) {
    console.error("Points route error:", error)

    // 根据错误类型返回不同的状态码
    if (error instanceof Error && error.message.includes("Failed to")) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
