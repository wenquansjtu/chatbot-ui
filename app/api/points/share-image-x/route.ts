import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ensureUserPointsRecord } from "@/db/points"

export async function POST(request: Request) {
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

    // Get request body
    const { messageId, imagePath } = await request.json()

    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 }
      )
    }

    // 确保用户有积分记录（使用新的辅助函数）
    await ensureUserPointsRecord(user.id)

    // Perform image share X bonus using database function
    const { data, error } = await supabase.rpc("image_share_x_bonus", {
      user_uuid: user.id,
      message_uuid: messageId,
      image_path: imagePath || ""
    })

    if (error) {
      console.error("Image share X bonus error:", error)
      return NextResponse.json(
        { error: "Failed to process image share bonus" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Image share X route error:", error)

    // 根据错误类型返回不同的响应
    if (error instanceof Error && error.message.includes("Failed to")) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
